
// Metadata model
var useAsId = ["imdb_id", "yt_id", "filmon_id"];
app.factory('metadata', ['$sce', function($sce) {
	return function metadata(meta) {
		var self = this;
		_.extend(self, meta);

		self.popularities = self.popularities || {};

		// auto-generate id from useAsId properties or generic "id" property
		var usableId = (self.id && self.id.split(":").length == 2) ? self.id : null;
		Object.defineProperty(self, "id", { enumerable: true, get: function() {
			if (self.imdb_id) return self.imdb_id;
			if (usableId) return usableId;
			for (var i=0; i!=useAsId.length; i++) if (self[useAsId[i]]) return useAsId[i]+":"+self[useAsId[i]];
		} });
		
		var getIdFromStr = function(str) {
			if (str.match("^tt")) return { imdb_id: str };
			if (str.match(":")) return _.object([ str.split(":")[0] ], [ str.split(":")[1] ]); // generic
		}

		// this gets passed to stream.find add-on method
		self.getQuery = function(extra) {
			var query = _.extend({ type: self.type }, getIdFromStr(this.id));
			if (self.type == "series") _.extend(query, { season: 1, episode: 1 });
			if (extra) _.extend(query, { yt_id: extra.id, season: extra.season, episode: extra.number });
			return query;
		};

		self.getPoster = function() {
			//console.log(this.fanart) // TODO
			var url = this.poster;
			if (! url) return url;
			if (! url.match(/imdb/)) return url;
			var width = 210, height = 300; // TODO: respect size
			//var width = 200, height = 296;
			var poster = (url.split("@@")[0]+"@@"+"._V1._SX" + width + "_CR0,0," + width + "," + height + "_.jpg");
			return (window.location.hostname == "localhost" || window.cordova) ? poster : "/poster/"+encodeURIComponent(poster);
		};

		self.descriptionHTML = function() { 
			return this.description && $sce.trustAsHtml(this.description
				.replace(/\n/g, '<br>')
				// .replace(new RegExp("(?:(?:https?|ftp|file)://|www\.|ftp\.)[-A-Z0-9+&@#/%=~_|$?!:,.]*[A-Z0-9+&@#/%=~_|$]", "gi"), function(match, c, offset, s) {
				//     return "<a onclick='require(\"nw.gui\").Shell.openExternal(\""+(match.match("^http://") ? match : "http://"+match)+"\")'>"+match+"</a>";
				// })
			);
		};
	};
}]);
