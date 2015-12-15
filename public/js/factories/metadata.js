
// Metadata model
var useAsId = ["imdb_id", "yt_id", "filmon_id", "streamfeed_id"]; // TODO: load from add-ons
app.factory('metadata', function() {
	return function metadata(meta) {
		var self = this;
		_.extend(self, meta);

		self.popularities = self.popularities || {};

		// auto-generate id from useAsId properties
		Object.defineProperty(self, "id", { enumerable: true, get: function() {
			if (self.imdb_id) return self.imdb_id;
			for (var i=0; i!=useAsId.length; i++) if (self[useAsId[i]]) return useAsId[i]+":"+self[useAsId[i]];
		} });
		
		// this gets passed to stream.find add-on method
		self.getQuery = function(extra) {
			var query = _.extend({ type: self.type }, _.pick(self, useAsId));
			if (self.type == "series") _.extend(query, { season: 1, episode: 1 });
			if (extra) _.extend(query, { yt_id: extra.id, season: extra.season, episode: extra.number });
			return query;
		};
	};
});
