const fs = require("fs");
var sb = [];
function debug() {
    for(var x = 0; x < arguments.length;x++) {
        sb.push("" + arguments[x].toString());
    }
}
var cache = {};
function DiskProxy(folder,ftype,options) {
    options = options || {};
    //console.log("================================================================================")
	//console.log("DISKPROXY ",folder,ftype);
    if(folder.indexOf("..")!=-1) throw new Error("not allowed relative");
	ftype = ftype || "object";

	var compiled_name = folder + ":" + ftype;
	if(compiled_name in cache) return cache[compiled_name];
	
    var obj = {};
    var diskproxy = new Proxy(obj,{
        construct: function(target, argumentsList, newTarget) {
            //console.log("diskproxy.ctor");
            return diskproxy;
        },
        set : function(target,prop,value) {
            //console.log("diskproxy.set => " + chalk.green.bold(prop));
            //console.log(target)
            //console.log(prop)
            //console.log(value)
            //console.log("diskproxy.set @1");
            var t = Object.prototype.toString.apply(value);
            //console.log(t);
            if(t == "[object Boolean]") {
                var data = {};
                data.type = "boolean";
				data.value = value;
				fs.writeFileSync(folder+"/"+prop,JSON.stringify(data),"utf8");
                return value;
            } else if(t == "[object String]") {
                var data = {};
                data.type = "string";
				data.value = value;
				fs.writeFileSync(folder+"/"+prop,JSON.stringify(data),"utf8");
				return value;
            } else if(t == "[object Number]") {
                var data = {};
                data.type = "number";
				data.value = value;
				fs.writeFileSync(folder+"/"+prop,JSON.stringify(data),"utf8");
				return value;
            } else if(t == "[object Object]") {
                var json = {};
                var data = {};
                if(!fs.existsSync(folder+"/"+prop)) {
                    data.type = "object";
                    data.value = { type : "object" };
                    fs.writeFileSync(folder+"/"+prop,JSON.stringify(data),"utf8");
                    if(!fs.existsSync(folder+"/."+prop)) {
                        fs.mkdirSync(folder+"/."+prop)
                    }
                    var cp = DiskProxy( folder + "/." + prop , "object",options);
                    for(var key in value) {
                        cp[key] = value[key];
                    }
                    return cp;
                } else {
                    var cp = DiskProxy( folder + "/." + prop , "object",options);
                    for(var key in value) {
                        cp[key] = value[key];
                    }
                    return cp;
                }
            } else if(t == "[object Array]") {
                var data = {};
                data.type = "array";
                data.value = { type : "array" };
                fs.writeFileSync(folder+"/"+prop,JSON.stringify(data),"utf8");
                if(!fs.existsSync(folder+"/."+prop)) {
                    fs.mkdirSync(folder+"/."+prop)
                }
                var cp = DiskProxy( folder + "/." + prop , "array",options);
                for(var x = 0; x < value.length;x++) {
                    cp[x] = value[x];
                }
                cp.length = value.length;
                return cp;
            } else if(t == "[object Function]") {
				var data = {};
				data.type = "function";
				data.value = value.toString();
				fs.writeFileSync(folder+"/"+prop,JSON.stringify(data),"utf8");
				return value;
            } else if(t == "[object Date]") {
                var data = {};
                data.type = "date";
                data.value = value.valueOf();
                fs.writeFileSync(folder+"/"+prop,JSON.stringify(data),"utf8");
				return value;
            } else if(t == "[object DiskProxy]") {
				// reference
				var data = {};
				data.type = "reference";
				if( value["@type"] == "[object Diskproxy.Object]" ) {
					data.value = JSON.stringify({ folder : value["@folder"], type : "object" });
				} else if( value["@type"] == "[object Diskproxy.Array]" ) {
					data.value = JSON.stringify({ folder : value["@folder"], type : "array" });
				}
				fs.writeFileSync(folder+"/"+prop,JSON.stringify(data),"utf8");
				return value;
			} else {
                throw "not implemented diskproxy.set ???";
            }
        },
        get: function(target, name) {
            //console.log("diskproxy.get =>" + chalk.green.bold(name));
            if( typeof name === 'symbol' ) {
				if("Symbol(Symbol.toStringTag)" == name.toString()) { 
					return "DiskProxy"; 
				} else {
					console.log("SYMBOL::"+name.toString());
				}
				var ret = "SYMBOL:" + folder + ":get symbol :" + name.toString();
                return ret;
            }
            //console.log("diskproxy.get "+folder + ":" + name + ":" + ftype);
			if(name == "@version") {
				return [3,0,0];
            } else if(name == "@folder") {
				return folder;
			} else if(name == "@type") {
                //console.log("prototype.@type");
                if( ftype == "object" ) {
                    return "[object DiskProxy.Object]";
                }
                if( ftype == "array" ) {
                    return "[object DiskProxy.Array]";
                }
                throw "not implemented disproxy.get.@type for ftype:"+ftype;
			} else if(ftype == "array" && name == "push") {
				function gen() {
					return function() {
						var len = this.get(target,"length");
						for(var x = 0; x < arguments.length;x++) {
							this.set(target,len+x,arguments[x]);
						}
						this.set(target,"length",len+arguments.length);
					}
				}
				var f = gen();
				return f.bind(this);
			} else if(ftype == "array" && name == "pop") {
				function gen() {
					return function() {
						var len = this.get(target,"length");
						var data = this.get(target,len-1);
						if(len <= 0) {
							this.set(target,"length",0);
						} else {
							this.set(target,"length",len-1);
						}
						if(len ==0) return null;
						return data;
					}
				}
				var f = gen();
				return f.bind(this);
			} else if(ftype =="array" && name =="toArray") {
                //console.log("prototype.toArray");
                function gen(folder) {
                    return function(offset,amount) {
                        var r = [];
                        var len = this.get(target,"length");
                        offset = offset || 0;
                        amount = amount || len;
                        for(var x = offset; x < offset+amount;x++) {
                            if(!fs.existsSync(folder+"/"+x)) {
                                //console.log("get not found (folder:"+folder+"/name:"+x+")");
                                r.push( undefined );
                            } else if(fs.lstatSync(folder+"/"+x).isFile()) {
                                var json = JSON.parse( fs.readFileSync(folder+"/"+x,"utf8") );
                                //console.log(json);
                                if(json.type == "string") {
                                    r.push( json.value );
                                } else if(json.type == "number") {
                                    r.push( json.value );
                                } else if(json.type == "object") {
                                    r.push( DiskProxy(folder+"/."+x,"object",options).toObject() );
                                } else if(json.type == "array") {
                                    r.push( DiskProxy(folder+"/."+x,"array",options).toArray(0,10) );
                                } else if(json.type == "null") {
                                    r.push( null );
                                } else if(json.type == "date") {
                                    r.push( new Date( json.value ) );
                                } else if(json.type == "function") {
                                    if("evalValue" in options) {
                                        var __f = options.evalValue(json.value);
                                        r.push( __f.bind(diskproxy) );
                                    } else {
                                        eval("var __f = " + json.value);
                                        r.push( __f.bind(diskproxy) );
                                    }
                                } else if(json.type == "reference") {
									var val = JSON.parse(json.value);
									r.push( DiskProxy(val.folder,val.type,options) );
								} else {
                                    throw "not implemented diskproxy.toArray:unkown";
                                }
                            }
                        }
                        return r;
                    };
                }
                var f = gen(folder);
				return f.bind(this);
			} else if(ftype == "object" && name == "toObject") {
                //console.log("prototype.toObject");
                var self = this;
                function gen(folder) {
                    return function() {
                        var obj = {};
                        var keys = self.ownKeys(self);
                        for(var x = 0; x < keys.length;x++) {
                            //var a = self.get(self,keys[x]);
                            if(!fs.existsSync(folder+"/"+keys[x])) {
                                //console.log("get not found (folder:"+folder+"/name:"+keys[x]+")");
                                obj[keys[x]] = undefined;
                            } else if(fs.lstatSync(folder+"/"+keys[x]).isFile()) {
                                var json = JSON.parse( fs.readFileSync(folder+"/"+keys[x],"utf8") );
                                //console.log(json);
                                if(json.type == "string") {
                                    obj[keys[x]] = json.value;
                                } else if(json.type == "number") {
                                    obj[keys[x]] = json.value;
                                } else if(json.type == "object") {
                                    obj[keys[x]] = DiskProxy(folder+"/."+keys[x],"object",options).toObject();
                                } else if(json.type == "array") {
                                    obj[keys[x]] = DiskProxy(folder+"/."+keys[x],"array",options).toArray();
                                } else if(json.type == "null") {
                                    obj[keys[x]] = null;
                                } else if(json.type == "date") {
                                    obj[keys[x]] = new Date(json.value);
                                } else if(json.type == "function") {
                                    if("evalValue" in options) {
                                        var __f = options.evalValue(json.value);
                                        obj[keys[x]] = __f.bind(diskproxy);
                                    } else {
                                        eval("var __f = " + json.value);
                                        obj[keys[x]] = __f.bind(diskproxy);
                                    }

                                } else if(json.type == "reference") {
									var val = JSON.parse(json.value);
									obj[keys[x]] = DiskProxy(val.folder,val.type,options);
								} else {
                                    throw "not implemented diskproxy.toObject:unkown";
                                }
                            }
                        }
                        return obj;
                    };
                }
                var f = gen(folder);
				return f.bind(this);
			}
			if(!fs.existsSync(folder+"/"+name)) {
                //console.log(chalk.green.bold("not found " + name));
				//console.log("get not found (folder:"+folder+" , name:"+name+")");
				return undefined;
			} else if(fs.lstatSync(folder+"/"+name).isFile()) {
				var json = JSON.parse( fs.readFileSync(folder+"/"+name,"utf8") );
                //console.log(json);
                if(json.type == "string") {
                    //console.log(chalk.green.bold("string"));
					return json.value;
				} else if(json.type == "number") {
                    //console.log(chalk.green.bold("number"));
					return json.value;
				} else if(json.type == "object") {
                    //console.log(chalk.green.bold("object"));
                    return DiskProxy(folder+"/."+name,"object",options);
                } else if(json.type == "array") {
                    //console.log(chalk.green.bold("array"));
                    return DiskProxy(folder+"/."+name,"array",options);
                } else if(json.type == "null") {
                    //console.log(chalk.green.bold("null"));
					return null;
				} else if(json.type == "date") {
                    return new Date(json.value);
                } else if(json.type == "function") {
					//console.log(chalk.green.bold("function"));
                    if("evalValue" in options) {
                        var __f = options.evalValue(json.value);
                        return __f.bind(diskproxy);
                    } else {
                        eval("var __f = " + json.value);
                        return __f.bind(diskproxy);
                    }
                } else if(json.type == "reference") {
					//console.log(chalk.green.bold("reference"));
					var val = JSON.parse(json.value);
					return DiskProxy(val.folder,val.type,options);
				} else {
                    //console.log(chalk.green.bold("unkown"));
                    throw "not implemented diskproxy.get";
                }
            }
        },
        has : function(target,name) {
            //console.log("diskproxy.has " +folder+":"+name);
			if(fs.existsSync(folder+"/"+name) && fs.lstatSync(folder+"/"+name).isFile()) {
				//console.log(true);
				return true;
			} else {
				//console.log(false);
				return false;
			}
            throw "not implemented diskproxy.has";
        },
        deleteProperty : function (target,name) {
            //console.log("diskproxy.deleteProperty " + folder + ":" + name);
            // throw "not implemented diskproxy.deleteProperty";
            // console.log("delete diskproxy folder:" + folder + " name:" + name);
            function rrmdir(folder1) {
                var list = fs.readdirSync(folder + "/." + folder1);
                for(var x = 0; x < list.length;x++) {
                    if(fs.existsSync( folder + "/." + folder1 + "/" + list[x] ) ) {
                        if( fs.lstatSync(folder + "/." + folder1 + "/" + list[x]).isDirectory() ) {
                            
                        } else {
                            var json2 = fs.readFileSync(folder + "/." + folder1 + "/" + list[x],"utf8")
                            json2 = JSON.parse( json2 );
                            if(json2.type =="string" || json.type == "boolean" || json2.type =="number" || json2.type =="null" || json2.type =="function" || json2.type == "reference" || json2.type == "date") {
                                fs.unlinkSync(folder + "/." + folder1 + "/" + list[x]);	
                            } else if(json2.type == "array" || json2.type == "object" ) {
                                rrmdir(folder1 + "/." + list[x]);
                                fs.unlinkSync(folder + "/." + folder1 + "/" + list[x]);	
                            } else {
                            }
                        }
                    }
                }
                fs.rmdirSync(folder+"/."+folder1);
            }
			if(!fs.existsSync(folder+"/"+name)) return;
			if(fs.lstatSync(folder+"/"+name).isFile()) {
				var json = JSON.parse( fs.readFileSync(folder+"/"+name,"utf8") );
				if(json.type == "string" || json.type == "boolean" || json.type == "number"|| json.type =="null" || json.type =="function" || json.type == "reference" || json.type == "date") {
					fs.unlinkSync(folder+"/"+name);
					return true;
				} else if(json.type == "object"||json.type == "array") {
					try {
						rrmdir(name);
						fs.unlinkSync(folder+"/"+name);
					} catch(e) {
                        console.log(e);
						console.log(e.errno);
						console.log(e.code);
						console.log(e.syscall);
						console.log(e.message);
						console.log(e.stacktrace);
						return false;
					}
					return true;
				} else {
					return false;
				}
			}
        },
        ownKeys : function (target) {
            //console.log("diskproxy.ownKeys "+folder);
			if(fs.existsSync(folder)) {
                var list = fs.readdirSync(folder);
                //console.log(list);
				var r = [];
				for(var x = 0; x < list.length;x++) {
					if(list[x].indexOf(".")!=0) {
						r.push(list[x]);
					}
				}
				return r;
			} else {
				return [];
            }
        },
        getOwnPropertyDescriptor: function(target, name) {
            //console.log("diskproxy.getOwnPropertyDescriptor " + folder + ":" + name);
            //throw "not implemented diskproxy.getOwnPropertyDescriptor";
            if(fs.existsSync(folder+"/"+name)) {
				if(fs.lstatSync(folder+"/"+name).isFile()) {
					var str = fs.readFileSync(folder+"/"+name,"utf8");
					var json = JSON.parse( str );
					if(json.type == "string" || json.type == "boolean" || json.type == "number" || json.type == "null") {
						return { configurable: true, enumerable: true, value: json.value };
                    } else if(json.type == "date") {
                        return { configurable: true, enumerable:true, value: new Date(json.value) };
					} else if(json.type == "object" || json.type == "array") {
                        return { configurable: true, enumerable: true, value: DiskProxy(folder+"/."+name,json.type,options) };
					} else if(json.type == "function") {
                        if("evalValue" in options) {
                            var __f = options.evalValue(json.value);
                            return { configurable: true, enumerable: true, value: __f.bind(diskproxy) };
                        } else {
                            eval("var __f = " + json.value);
                            return { configurable: true, enumerable: true, value: __f.bind(diskproxy) };
                        }
					} else if(json.type == "reference") {
						var val = JSON.parse(json.value);
						return { configurable: true, enumerable: true, value: DiskProxy(val.folder,val.type,options) };
					}
				} else {
					throw "must not get here";
				}
			} else {
				if(name == "constructor") {
                    //throw "not implemented diskproxy.getOwnPropertyDescriptor:constructor"
					var self = this;
					return { configurable: true, enumerable: false, value: null };
				}
				return { configurable: true, enumerable: false, value: undefined };
			}
        }
    });
	cache[compiled_name] = diskproxy;
    return diskproxy;
}

module.exports = DiskProxy;