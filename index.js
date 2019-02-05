
const GenericProxy = require("./lib/GenericProxy.js");
const DiskProxy = require("./lib/DiskProxy.js");
const SHA1 = require("./lib/SHA1.js");
const uuid = require("./lib/uuid.js");
module.exports = {
	GenericProxy : GenericProxy,
	DiskProxy : DiskProxy,
	SHA1 : SHA1,
	uuid : uuid
};