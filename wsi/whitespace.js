/*!
 * whitespace.js v0.2 (http://naokikp.github.io/wsi/whitespace.html)
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

var longtimeout = false;
var timerid;

$(document).ready( function() {
	$("#run").click(run);

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
			setTimeout(codesize, 0);
		}
	})
	.blur(function(){
		window.document.onkeydown = function(e){return true;}
	});
	codesize();

	$("#longtimeout").click(function(){
		longtimeout = !longtimeout;
		$("#tostr").text("Timeout("+(longtimeout?60:5)+"sec)");
	});
});

function codesize(){$("#info_size").text($("#code").val().length);}

var label = new Array();
var heap = new Array();
var stack = new Array();
var callstack = new Array();
var stdin, stdout;
var parselog;
var inst, parm;
var running = false;

var tm_str;
var ridx;

function run(){
	if(running) return;
	var code = $("#code").val();
	stdin = $("#stdin").val();
	stdout = parselog = "";
	label.length = heap.length = stack.length = callstack.length = 0;

	try {
		$("#info_state").text("parsing");
		$("#info_msg").text("");
		var ic = parse(code);
		inst = ic[0];
		parm = ic[1];
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
	$("#info_state").text("running");
	ridx = 0;
	tm_str = +new Date();
	running = true;
	setTimeout(do_run, 0);
}

function do_run(){
	var tm_limit = 5*1000;
	if(longtimeout) tm_limit = 60*1000;
	var tm_str2 = +new Date();
	var inst_len = inst.length;
	try {
		while(ridx < inst_len){
			var tm_now = +new Date();
			if(tm_now-tm_str2 > 500){
				$("#info_time").text(tm_now-tm_str + " ms.");
				if(tm_now-tm_str > tm_limit) throw "Timeout";

				// 再実行
				setTimeout(do_run, 0);
				return;
			}

			var nextridx = inst[ridx](parm[ridx],ridx);
			if(typeof nextridx === "undefined") ridx++;
			else if(nextridx < 0) break;
			else ridx = nextridx;
		}
		var tm_end = +new Date();
		$("#info_state").text("terminated");
		$("#info_time").text(tm_end-tm_str + " ms.");
	} catch(e){
		$("#info_state").text("abort");
		$("#info_msg").text("op[" + ridx + "] " + e);
	}

	$("#stdout").val(stdout);
	running = false;
}

function parse(code){
	var tc = code.replace(/[^ \t\n]/g,"")
		.replace(/ /g,"S").replace(/\t/g,"T").replace(/\n/g,"L");

	var inst = new Array();
	var parm = new Array();
	var tclen = tc.length;
	var tcidx = 0;
	var inst_num = 0;
	var islen = is.length;

	while(tcidx < tclen){
		var i;
		for(i = 0; i < islen; i++){
			if(tc.substr(tcidx, is[i][0].length) === is[i][0]) break;
		}
		if(i < islen){
			inst[inst_num] = is[i][2];
			tcidx += is[i][0].length;
			if(!is[i][3]){
				plog("["+inst_num+"] "+is[i][0]+" ("+is[i][1]+")");
			} else {
				var m = tc.substring(tcidx).match(/^\w*?L/);
				if(!m) throw msg_ueoc + " at " + tcidx;
				var ps = m[0];
				parm[inst_num] = is[i][3](ps);
				tcidx += ps.length;
				plog("["+(is[i][1]==='label'?"--":inst_num)+"] "+is[i][0]+" "+ps+" ("+is[i][1]+" "+parm[inst_num]+")");
			}
			if(is[i][1] === 'label'){
				label[parm[inst_num]] = inst_num;
			} else {
				inst_num++;
			}
		} else {
			throw "unknown instruction : " + tc.substr(tcidx,8) + "...";
		}
	}
	return [inst, parm];
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
}
function op_load(){
	if(stack.length < 1) throw msg_tfis;
	var a = stack.pop();
	if(a < 0) throw "load: illegal address, " + a;
	stack.push(heap[a]);
}

function op_call(l,ridx){ callstack.push(ridx+1); return label[l]; }
function op_jmp(l){ return label[l]; }
function op_jmpz(l){
	if(stack.length < 1) throw msg_tfis;
	if(stack.pop() == 0) return label[l];
}
function op_jmpn(l){
	if(stack.length < 1) throw msg_tfis;
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
}
