
// Requests: this is for requesting video streams from the add-ons system
// On the desktop app, this happens when clicking Play, here when selecting an item

app.factory("requests", ["stremio", function(stremio) {	
	var requests = { };
	var EventEmitter = require("EventEmitter");
	requests.candidates = function(args, callback, offlineOnly)
	{
		var handle = new EventEmitter(), updated = _.debounce(function() { handle.emit("updated") }, 200);
		handle.candidates = [];
		handle.query = angular.copy(args.query);

		var recv = 0, sent = 0, count = function(fn, id) { 
			sent++; 
			return function() { recv++; fn.apply(null, arguments); if (recv === sent) handle.emit("finish"); } 
		};

		// If we have a group that firts specifically to the arguments, discard the others ; true to .get as "noPicker"
		var services = stremio.get("stream.find", args).filter(function(x) { return x.initialized }), 
			max = (services[0] && services[0].manifest.filter) ? stremio.checkArgs(args, services[0].manifest.filter) : false,
		services = services.filter(function(x) { return stremio.checkArgs(args, x.manifest.filter) >= max });

		// Group by identifier, and fallthrough within each group
		args.stremio_rushed = true; // indicate to addons client to try the next one too if we don't get a quick response
		if (!offlineOnly) _.chain(services).groupBy(function(x) { return x.identifier() }).each(function(group, id) {
			stremio.fallthrough(group, "stream.find", args, count(function(err, resp, addon) {
				if (err) console.error(err);

				add((Array.isArray(resp) ? resp : []).filter(function(x) { return x }).map(function(x) { 
					x.addon = addon;
					x._id = x.infoHash + (x.hasOwnProperty('mapIdx') ? '/'+x.mapIdx : '') || x.url || x.externalUrl || x.yt_id; /// for _.uniq
					x.availability = x.hasOwnProperty('availability') ? x.availability : 1;
					return x;
				}));
			}));
		}).value();

		function add(resp) {
			var len = handle.candidates.length, hadFirst = !!handle.first;
			handle.candidates = _.uniq(handle.candidates.concat(resp || []), function(x) { return x._id });
			handle.selected = handle.first = handle.candidates[0];

			if (handle.candidates.length > len || !hadFirst) updated();
			if (handle.first && handle.first.isPlayable && !handle.first.isExternal) handle.emit("viable");
		};

		handle.on("finish", function() { handle.finished = true }); 

		return handle;
	};

	return requests;
}]);
