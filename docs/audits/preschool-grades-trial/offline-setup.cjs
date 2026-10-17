const deny = () => { throw new Error('Network access prohibited in component tests'); };
global.fetch = deny;
XMLHttpRequest.prototype.open = deny;
if (global.WebSocket) global.WebSocket = class { constructor() { deny(); } };
