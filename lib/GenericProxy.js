function uuid() {
   var chars = '0123456789abcdef'.split('');
   var uuid = [], rnd = Math.random, r;
   uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
   //uuid[14] = '4'; // version 4
   for (var i = 0; i < 36; i++) {
      if (!uuid[i]) {
         r = 0 | rnd()*16;
         uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r & 0xf];
      }
   }
   return uuid.join('');
}

const inspect = Symbol.for('nodejs.util.inspect.custom');
function GenericProxy(parentData,parentProxy,name,value,static_uuid) {
	if(arguments.length == 0) { // name = $
		name = "$";
		value = null;
		parentProxy = null;
		parentData = null;
	} else if(arguments.length == 1) { // name
		name = parentData;
		value = null;
		parentData = null;
		parentProxy = null;
	} else if(arguments.length == 2) { // name, value
		name = parentData;
		value = parentProxy;
		parentProxy = null;
		parentData = null;
	}
	var obj = {
		uuid : static_uuid || uuid(),
		hardlocked : false,
		locked : false,
		password : null,
		name : name,
		value : value,
		parentData : parentData,
		parentProxy : parentProxy,
		isLocked : function() {
			var check = false;
			var p =  this;
			while(true) {
				if(p.hardlocked) {
					check = true;
					break;
				}
				if(p.locked) {
					check = true;
					break;
				}
				if(p.parentData!=null) {
					p = p.parentData;
				} else {
					break;
				}
			}
			return check;
		},
		paths : {}
	};
	var proxy = new Proxy(obj,{
		get : function(target,prop) {
			//console.log("all:",prop);
			if( typeof prop === 'symbol' ) {
				//console.log("?SYMBOL:",prop.toString());
				if("Symbol(Symbol.toStringTag)" == prop.toString()) { 
					return "GenericProxy"; 
				} else if("Symbol(Symbol.toPrimitive)" == prop.toString()) {
					return function() {
						if(!target.isLocked()) {
							return target.value; 
						} else {
							throw new Error("it is locked.");
						}
					}
				} else if("Symbol(util.inspect.custom)" == prop.toString()) {
					return "GenericProxy1"; 
				} else if("Symbol(Symbol.iterator)" == prop.toString()) {
					return "GenericProxy2"; 
				} else {
					console.log("SYMBOL::"+prop.toString());
				}
                return "SYMBOL";
            }
			prop = (""+prop).split(".").join("\\.");
			//console.log(prop);
			if(!target.isLocked()) {
				if(prop in target.paths) {
					return target.paths[prop];
				}
			} else {
				throw new Error("it is locked.");
			}
			switch(prop) {
				case ":set":
					return function(val) {
						if(!target.isLocked()) {
							target.value = val;
							return val;
						} else {
							throw new Error("it is locked.");
						}
					}
				case ":setref":
					return function(val) {
						if(!target.isLocked()) {
							target.value = val;
							return proxy;
						} else {
							throw new Error("it is locked.");
						}
					}
				case ":getref":
					return proxy;
				case ":type":
					return Object.prototype.toString.apply(target.value);
				case ":get":
					if(Object.prototype.toString.apply(target.value) == "[object Function]") {
						return target.value.bind(target.parentProxy);
					} else {
						return target.value;
					}
				case ":name":
					var stack = [];
					var p = target;
					while(p!=null) {
						stack.unshift( p.name );
						p = p.parentData;
					}
					return stack.join(".");
				case ":keys":
					var r = [];
					for(var key in target.paths) {
						r.push(key);
					}
					return r;
				case ":lock":
					return function(password) {
						if(!target.locked) {
							target.locked = true;
							target.password = password;
						}
					}
				case ":unlock":
					return function(password) {
						if(target.locked) {
							if(target.password == password) {
								target.locked = false;
							} else {
								target.hardlocked = true;
								throw new Error("invalid password");
							}
						}
					}
				case ":find":
					var self = this;
					return function(filter) {
						filter = filter || function() { return true; }
						var r = [];
						if(!target.isLocked()) {
							var r = [];
							if( filter( self.get(target,":get"), self.get(target,":name") ) ) {
								r.push(self.get(target,":name"));
							}
							for(var key in target.paths) {
								//console.log(">>",target.paths[key][":full"]);
								r = r.concat( target.paths[key][":find"](filter) );
							}
							return r;
						} else {
							throw new Error("it is locked.");
						}
					}
				case ":meta":
					target.paths[prop] = new GenericProxy(target,proxy,prop,null);
					return target.paths[prop];
				case ":parent":
					return target.parentProxy;
				case ":delete":
					if(target.parentData!=null) {
						delete target.parentData.paths[ target.name ];
					}
					return;
				case ":toJSON":
					// if not locked
					var sb = [];
					// { names : { type: t , value : v } } , meta as new name
					// all names must be inside this
					// check if links are not locked
					return sb.join("");
				case ":fromJSON":
					// if not locked
					return function(json_str) {
						if(!target.isLocked()) {
							return proxy;
						} else {
							throw new Error("it is locked.");
						}
					};
				case "valueOf":
					return function() { 
						if(!target.isLocked()) {
							if(Object.prototype.toString.apply(target.value) == "[object Function]") {
								return target.value.bind(target.parentProxy);
							} else {
								return target.value;
							}
						} else {
							throw new Error("it is locked.");
						}
					}
			}
			
			target.paths[prop] = new GenericProxy(target,proxy,prop,null);
			return target.paths[prop];
		},
		set : function(target,prop,value) {
			prop = (""+prop).split(".").join("\\.");
			//console.log(prop);
			if(target.isLocked()) {
				throw new Error("it is locked.");
			}
			if(prop in target.paths) {
				target.paths[prop][":set"](value);
			} else {
				target.paths[prop] = new GenericProxy(target,proxy,prop,null);
				target.paths[prop][":set"](value);
			}
		},
		has : function(target,key) {
			console.log("has");
			if(key in target.paths) {
				return true;
			}
			return false;
		},
		ownKeys : function(target) {
			//console.log("ownKeys",target.name);
			var r = [];
			for(var key in target.paths) {
				r.push(key);
			}
			return r;
		}
	});
	return proxy;
}

module.exports = GenericProxy;