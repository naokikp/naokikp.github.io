/*!
 * whitespace.js v0.6 (http://naokikp.github.io/wsi/whitespace.html)
 * Copyright 2015 @naoki_kp
 * Licensed under MIT (http://opensource.org/licenses/mit-license.php)
 */

// JavaScriptほとんど書いたことないのでみちゃらめぇ

var is = [
// Stack Manipulation
    [ 'SS',     'push',     op_push,    number  ],
    [ 'SLS',    'dup',      op_dup,             ],
    [ 'STS',    'copy',     op_copy,    number  ],
    [ 'SLT',    'swap',     op_swap,            ],
    [ 'SLL',    'pop',      op_pop,             ],
    [ 'STL',    'slide',    op_slide,   number  ],
// Arithmetic
    [ 'TSSS',   'add',      op_add,             ],
    [ 'TSST',   'sub',      op_sub,             ],
    [ 'TSSL',   'mul',      op_mul,             ],
    [ 'TSTS',   'div',      op_div,             ],
    [ 'TSTT',   'mod',      op_mod,             ],
// Heap Access
    [ 'TTS',    'store',    op_store,           ],
    [ 'TTT',    'load',     op_load,            ],
// Flow Control
    [ 'LSS',    'label',    0,          label   ],
    [ 'LST',    'call',     op_call,    label   ],
    [ 'LSL',    'jmp',      op_jmp,     label   ],
    [ 'LTS',    'jmpz',     op_jmpz,    label   ],
    [ 'LTT',    'jmpn',     op_jmpn,    label   ],
    [ 'LTL',    'ret',      op_ret,             ],
    [ 'LLL',    'end',      op_end,             ],
// I/O
    [ 'TLSS',   'prtc',     op_prtc,            ],
    [ 'TLST',   'prtn',     op_prtn,            ],
    [ 'TLTS',   'readc',    op_readc,           ],
    [ 'TLTT',   'readn',    op_readn,           ],
];

var msg_ueoc = "Unexpected end of code";
var msg_tfis = "Too few items in stack";
var msg_tfics = "Too few items in callstack";
var msg_rteoi = "Reached to end of input";
var msg_divz = "division by zero";
var msg_illp = "illegal parameter, ";
var msg_illn = "(input) illegal number, ";
var msg_nosl = "no such label, ";

var longtimeout = false;
var visible = false;
var timerid;

var store;
if(typeof sessionStorage !== 'undefined'){
	store = sessionStorage;
	var val = sessionStorage.getItem("longtimeout");
	if(val) longtimeout = (val === 'true');
	var val = sessionStorage.getItem("visible");
	if(val) visible  = (val === 'true');
}

$(document).ready( function() {
	$("#run").click(function(){run(false);});
	$("#step").click(function(){run(true);});

	// ref: http://scrap.php.xdomain.jp/textarea_insert_tab/
	function addStr(id, str){
		var obj = document.getElementById(id);
		var sPos = obj.selectionStart;
		var ePos = obj.selectionEnd;
		var addStr = obj.value.substr(0, sPos) + str + obj.value.substr(ePos);
		var cPos = sPos + str.length;
		jQuery(obj).val(addStr);
		obj.setSelectionRange(cPos, cPos);
	}
	$("#code")
	.focus(function(){
		window.document.onkeydown = function(e){
			if(e.keyCode === 9){
				addStr(this.activeElement.id, "\t");
				e.preventDefault();
			}
			if(e.ctrlKey && e.keyCode === 13) run();
			setTimeout(codesize, 0);
		}
	})
	.blur(function(){
		window.document.onkeydown = function(e){return true;}
	});

	var param = window.location.search;
	if(param.length > 1){
		var code = param.substring(1).replace(/[^STLN]/g,"").replace(/N/g,"L");
		if(!visible) code = to_invisible(code);
		$("#code").val(code);
	}

	$("#code").prop("disabled", false);
	codesize();

	var func_longtimeout = function(){
		$("#tostr").text("Timeout("+(longtimeout?60:5)+"s)");
	};
	$("#longtimeout").click(function(){
		longtimeout = !longtimeout;
		func_longtimeout();
		if(store) sessionStorage.setItem("longtimeout", longtimeout);
	});
	func_longtimeout();

	var func_visible = function(){
		$("#ivstr").text(visible?"Visible":"Invisible");
	};
	$("#visible").click(function(){
		visible = !visible;
		func_visible();
		if(store) sessionStorage.setItem("visible", visible);

		// convert
		var code = $("#code").val();
		var tc = (visible?to_visible:to_invisible)(code);
		$("#code").val(tc);
	});
	func_visible();
});

function to_invisible(s){
	return s.replace(/[^STLN]/g,"").replace(/S/g," ").replace(/T/g,"\t").replace(/[LN]/g,"\n");
}
function to_visible(s){
	return s.replace(/[^ \t\n]/g,"").replace(/ /g,"S").replace(/\t/g,"T").replace(/\n/g,"L");
}

function codesize(){$("#info_size").text($("#code").val().length);}

var label;
var heap = new Array();
var stack = new Array();
var callstack = new Array();
var stdin, stdout;
var parselog;
var inst, parm, opcd;
var running = false;
var steprunning = false;

var tm_str;
var ridx;
var heapidx_last;

function run(step){
	if(running) return;
	if(steprunning){
		return do_run(step);
	}

	var code = $("#code").val();
	stdin = $("#stdin").val();
	stdout = parselog = "";
	delete label;
	label = new Object();
	heap.length = stack.length = callstack.length = 0;
	heapidx_last = -1;

	try {
		$("#info_state").text("parsing");
		$("#info_msg").text("");
		var ic = parse(code);
		inst = ic[0], parm = ic[1], opcd = ic[2];
	} catch(e){
		$("#info_state").text("parse error");
		$("#info_msg").text(e);
		$("#stdout").val(parselog);
		return;
	}
	if($("#parseonly").prop("checked")){
		$("#info_state").text("parsed");
		$("#info_time").text("-");
		$("#stdout").val(parselog);
		return;
	}
	if(inst.length == 0){
		$("#info_state").text("not running");
		$("#info_time").text("-");
		return;
	}

	ridx = 0;
	tm_str = +new Date();

	if(step){
		$("#code").prop("disabled", true);
		$("#dinfo").show();
		$("#info_state").text("running(step)");
		disp_dinfo();
		steprunning = true;
	} else {
		$("#dinfo").hide();
		$("#info_state").text("running");
		setTimeout(do_run, 0);
		running = true;
	}
}

function disp_dinfo(){
	if(ridx < 0){
		$("#dinfo_pos").text("-");
	} else {
		$("#dinfo_pos").text("["+ridx+"] "+opcd[ridx]);
	}
	if(stack.length == 0){
		$("#dinfo_stack").text("-");
	} else {
		var l = stack.length;
		var s = "";
		for(var i = 0; i < 8; i++){
			if(i >= l) break;
			s += "["+i+"] "+stack[l-i-1]+"\n";
		}
		$("#dinfo_stack").text(s);
	}

	var j = heapidx_last - 3;
	if(j < 0) j = 0;
	var s = "";
	for(var i = j; i < j+8; i++){
		var v = heap[i];
		if(typeof v == "undefined") v = "-";
		var t = "["+i+"] "+v;
		if(i == heapidx_last){
			s += "<span class=\"text-success\"><strong>"+t+"</strong></span>\n";
		} else {
			s += t+"\n";
		}
	}
	$("#dinfo_heap").html(s);

	$("#stdout").val(stdout);
}

function do_run(step){
	var tm_limit = 5*1000;
	if(longtimeout) tm_limit = 60*1000;

	if(steprunning && !step){
		$("#dinfo").hide();
		tm_str = +new Date();
		steprunning = false;
		running = true;
	}

	var tm_str2 = +new Date();
	var inst_len = inst.length;
	var dostep = false;
	try {
		while(ridx < inst_len){
			if(steprunning){
				if(dostep){
					disp_dinfo();
					return;
				}
			} else {
				var tm_now = +new Date();
				if(tm_now-tm_str2 > 500){
					$("#info_time").text(tm_now-tm_str + " ms.");
					if(tm_now-tm_str > tm_limit) throw "Timeout";

					// 再実行
					setTimeout(do_run, 0);
					return;
				}
			}

			var nextridx = inst[ridx](parm[ridx],ridx);
			if(typeof nextridx === "undefined") ridx++;
			else if(nextridx < 0) break;
			else ridx = nextridx;
			dostep = true;
		}
		ridx = -1;
		if(steprunning) disp_dinfo();
		$("#info_state").text("terminated");
	} catch(e){
		$("#info_state").text("abort");
		$("#info_msg").text("op[" + ridx + "] " + e);
	}

	var tm_end = +new Date();
	$("#info_time").text(tm_end-tm_str + " ms.");

	$("#code").prop("disabled", false);
	$("#stdout").val(stdout);
	running = steprunning = false;
}

function parse(code){
	var tc;
	if(visible){
		tc = code.replace(/[^STLN]/g,"").replace(/N/g,"L");
	} else {
		tc = to_visible(code);
	}

	var inst = new Array();
	var parm = new Array();
	var opcd = new Array();
	var tclen = tc.length;
	var tcidx = 0;
	var inst_num = 0;
	var islen = is.length;

	while(tcidx < tclen){
		for(var i = 0; i < islen; i++){
			if(tc.substr(tcidx, is[i][0].length) === is[i][0]) break;
		}
		if(i < islen){
			inst[inst_num] = is[i][2];
			opcd[inst_num] = is[i][1];
			tcidx += is[i][0].length;
			if(!is[i][3]){
				plog("["+inst_num+"] "+is[i][0]+" ("+is[i][1]+")");
			} else {
				var m = tc.substring(tcidx).match(/^\w*?L/);
				if(!m) throw msg_ueoc + " at " + tcidx;
				var ps = m[0];
				parm[inst_num] = is[i][3](ps);
				opcd[inst_num] += " " + parm[inst_num];
				tcidx += ps.length;
				plog("["+(is[i][1]==='label'?"--":inst_num)+"] "+is[i][0]+" "+ps+" ("+is[i][1]+" "+parm[inst_num]+")");
			}
			if(is[i][1] === 'label'){
				if(typeof label[parm[inst_num]] === 'undefined')
					label[parm[inst_num]] = inst_num;
			} else {
				inst_num++;
			}
		} else {
			throw "unknown instruction : " + tc.substr(tcidx,8) + "...";
		}
	}
	inst.length = parm.length = opcd.length = inst_num;
	return [inst, parm, opcd];
}

function plog(s){
	console.log(s);
	parselog += s + "\n";
}

function number(s){
	var len = s.length - 1;
	if(len < 1) throw "number: " + msg_illp + s;
	var sign = s[0] === 'S' ? 1 : -1;
	var val = 0;
	for(var i = 1; i < len; i++){
		val *= 2;
		if(s[i] === 'T') val++;
	}
	return sign * val;
}
function label(s){ return s; }

function op_push(n){ stack.push(n); }
function op_dup(){ stack.push(stack[stack.length-1]);}
function op_copy(n){
	if(n < 0 || n >= stack.length) throw "copy: " + msg_illp + n;
	stack.push(stack[stack.length-1-n]);
}
function op_swap(){
	var l = stack.length;
	if(l < 2) throw msg_tfis;
	var t=stack[l-1];stack[l-1]=stack[l-2];stack[l-2]=t;
}
function op_pop(){
	if(stack.length < 1) throw msg_tfis;
	stack.pop();
}
function op_slide(n){
	var l = stack.length;
	if(l < n+1) throw msg_tfis;
	stack.splice(l-n-1, n);
}

function op_add(){
	var l = stack.length;
	if(l < 2) throw msg_tfis;
	stack[l-2] += stack.pop();
}
function op_sub(){
	var l = stack.length;
	if(l < 2) throw msg_tfis;
	stack[l-2] -= stack.pop();
}
function op_mul(){
	var l = stack.length;
	if(l < 2) throw msg_tfis;
	stack[l-2] *= stack.pop();
}
function op_div(){
	var l = stack.length;
	if(l < 2) throw msg_tfis;
	var v = stack.pop();
	if(v == 0) throw msg_divz;
	stack[l-2] = Math.floor(stack[l-2] / v);
}
function op_mod(){
	var l = stack.length;
	if(l < 2) throw msg_tfis;
	var v = stack.pop();
	if(v == 0) throw msg_divz;

	var p = stack[l-2];
	var r = p % v;
// Haskellの演算結果に合わせる
//  5 mod  3 =  2 	<-	2
//  5 mod -3 = -1   <-	2
// -5 mod  3 =  1   <-	-2
// -5 mod -3 = -2   <-	-2
	if((p < 0) != (v < 0) && r != 0) r += v;
	stack[l-2] = r;
}

function op_store(){
	if(stack.length < 2) throw msg_tfis;
	var v = stack.pop();
	var a = stack.pop();
	if(a < 0) throw "store: illegal address, " + a;
	heap[a] = v;
	heapidx_last = a;
}
function op_load(){
	if(stack.length < 1) throw msg_tfis;
	var a = stack.pop();
	if(a < 0) throw "load: illegal address, " + a;
	var v = heap[a];
	if(typeof v === "undefined") v = 0;
	stack.push(v);
	heapidx_last = a;
}

function op_call(l,ridx){
	if(typeof label[l] === 'undefined') throw msg_nosl + l;
	callstack.push(ridx+1); return label[l];
}
function op_jmp(l){
	if(typeof label[l] === 'undefined') throw msg_nosl + l;
	return label[l];
}
function op_jmpz(l){
	if(stack.length < 1) throw msg_tfis;
	if(typeof label[l] === 'undefined') throw msg_nosl + l;
	if(stack.pop() == 0) return label[l];
}
function op_jmpn(l){
	if(stack.length < 1) throw msg_tfis;
	if(typeof label[l] === 'undefined') throw msg_nosl + l;
	if(stack.pop() < 0) return label[l];
}
function op_ret(){
	if(callstack.length < 1) throw msg_tfics;
	return callstack.pop();
}
function op_end(){ return -1; }

function op_prtc(){
	if(stack.length < 1) throw msg_tfis;
	var n = stack.pop();
	if(n < 0) throw "prtc: " + msg_illp + n;
	stdout += String.fromCharCode(n % 256);
}
function op_prtn(){
	if(stack.length < 1) throw msg_tfis;
	stdout += stack.pop().toString();
}
function op_readc(){
	if(stack.length < 1) throw msg_tfis;
	var a = stack.pop();
	if(stdin.length < 1) throw msg_rteoi;
	heap[a] = stdin.charCodeAt(0);
	stdin = stdin.substring(1);
	heapidx_last = a;
}
function op_readn(){
	if(stack.length < 1) throw msg_tfis;
	var a = stack.pop();
	if(stdin.length == 0) throw msg_rteoi;
	var m = stdin.indexOf("\n");
	if(m < 0) m = stdin.length;
	var s = stdin.substr(0,m);
	stdin = stdin.substring(m+1);
	var r = s.match(/^\s*(\-?)\s*(\d+)\s*$/);
	if(r){
		heap[a] = parseInt(r[1]+r[2]);
	} else throw msg_illn + '"' + s + '"';
	heapidx_last = a;
}
