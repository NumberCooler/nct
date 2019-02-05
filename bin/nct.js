#!/usr/bin/env node
var nct = require("../index.js");
var node =  process.argv[0];
var app =  process.argv[1];
var args = process.argv.slice(2);
const fs = require("fs");

function input(callback) {
	var data = [];
	process.stdin.resume();
	process.stdin.setEncoding('utf8');
	process.stdin.on('data', function(chunk) {
		data.push(chunk);
	});
	process.stdin.on('end', function() {
		callback(data.join(""));
	});
}

// @target
var boot = false;
if(!fs.existsSync(".ncdata")) {
	fs.mkdirSync(".ncdata");
	boot = true;
}
var disk = new nct.DiskProxy(".ncdata","object");
var memory = new nct.GenericProxy();
if(boot) {
	disk.sessions = {};
}
if(args.length == 1) {
	switch(args[0]) {
		case "readline":
			var sb = [];
			sb.push("const readline = require('readline');");
			sb.push("const rl = readline.createInterface({");
			sb.push("\tinput: process.stdin,");
			sb.push("\toutput: process.stdout");
			sb.push("});");
			sb.push("rl.question('>', (answer) => {");
			sb.push("\trl.close();");
			sb.push("});");
			console.log(sb.join("\n"));
			return;
		case "vm":
			var sb = [];
			sb.push("const vm = require('vm');");
			sb.push("const sandbox = {};");
			sb.push("const script = new vm.Script(text);");
			sb.push("const context = vm.createContext(sandbox);");
			sb.push("script.runInContext(context);");
			console.log(sb.join("\n"));
			return;
		case "randomInt":
			console.log( parseInt( Math.random()*(0xFFFFFFFF) ) );
			break;
		case "date":
			var dt = new Date();
			console.log("new Date(" +  
				dt.getFullYear() + "," + 
				dt.getMonth() + "," + 
				dt.getDate() + ","  + 
				dt.getHours() + "," + 
				dt.getMinutes() +  "," + 
				dt.getSeconds() +
			")");
			break;
		case "date.now":
			console.log("new Date()");
			break;
		case "console.log":
			input((data)=> {
				console.log("console.log(" + JSON.stringify(data.trim()) + ")");
			});
			break;
		case "print":
			input((data)=> {
				console.log(data.trim());
			});
			break;
		case "randomRange":
			break;
		case "uuid":
			break;
		case "guid":
			break;
	}
}
if(args.length == 2) {
	switch(args[0]) {
		case "newSession": // password=args[1]
			var id = nct.uuid();
			while(id in disk.sessions) {
				id = nct.uuid();
			}
			disk.sessions[id] = { hash: nct.SHA1(args[1]), data : {} };
			console.log(id);
			return;
		case "var":
			input((data)=>{
				console.log("var " + args[1] + " = " + data.trim() + ";");
			});
			break;
	}
}

var session = args.shift(); // session id
var password = args.shift();
if(!(session in disk.sessions)) {
	console.log(JSON.stringify({type:"error",message:"can't find session."}));
	return;
}
if( disk.sessions[session].hash != nct.SHA1(password) ) {
	console.log(JSON.stringify({type:"error",message:"can't log in."}));
	return;
}

if(args.length == 1) { // session arg
	switch(args[0]) {
		case "closeSession": //
			delete disk.sessions[session];
			console.log(JSON.stringify({type:"result",value:true}));
			return;
		case "shell":
			const readline = require('readline');
			let quit = false;
			const sandbox = {
				console : console,
				disk : disk.sessions[session].data,
				memory : memory,
				require : require,
				quit : function() {
					quit = true;
				}
			};
			function main() {
				const rl = readline.createInterface({
					input: process.stdin,
					output: process.stdout
				});
				rl.question('>', (answer) => {
					try {
						const vm = require('vm');
						const script = new vm.Script(answer);
						const context = vm.createContext(sandbox);
						script.runInContext(context);
					} catch(e) {
						console.log(e);
					}
					rl.close();
					if(!quit) main();
				});
			}
			main();
			return;
	}
} else if(args.length == 2) { // session arg1=args[0] arg2=args[1]
	switch(args[0]) {
		case "script": // instead of shell it loads commands from file.
			const sandbox = {
				console : console,
				disk : disk.sessions[session].data,
				memory : memory,
				require : require
			};
			const fs = require('fs');
			try {
				const vm = require('vm');
				const script = new vm.Script(fs.readFileSync(args[1],'utf8'));
				const context = vm.createContext(sandbox);
				script.runInContext(context);
			} catch(e) {
				console.log(e);
			}
			break;
		case "get":
			function parsePath(str) {
				var path = str.split(".");
				if(path[0] == "disk") {
					var p = disk.sessions[session].data;
					var i = 1;
					while(i < path.length) {
						p = p[path[i]];
						i++;
					}
					return p;
				}
			}
			var val = parsePath(args[1]);
			var type = Object.prototype.toString.apply(val);
			if(type == "[object Number]") console.log(val);
			if(type == "[object String]") console.log(val);
			if(type == "[object Date]") console.log(val);
			//if(type == "[object Function]") console.log(val);
			if(type == "[object DiskProxy]") {
				if( val["@type"] == "[object DiskProxy.Object]" ) console.log(val.toObject());
				if( val["@type"] == "[object DiskProxy.Array]" ) console.log(val.toArray());
			}
			break;
	}
} else if(args.length == 3) { // session arg1=args[0] arg2=args[1] arg3=args[2]
	switch(args[0]) {
		case "set": // var args[1] val args[2]
			function parsePath(str) {
				var path = str.split(".");
				if(path[0] == "disk") {
					var p = disk.sessions[session].data;
					var i = 1;
					while(i < path.length-1) {
						p = p[path[i]];
						i++;
					}
					return [p,path[i]];
				}
			}
			var val = parsePath(args[1]);
			val[0][ val[1] ] = JSON.parse(args[2]);
			break;
	}
}

