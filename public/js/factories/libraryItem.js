var _ = require("lodash");
var metadata = require("./metadata");

var Sqlite = require("nativescript-sqlite");

function libraryItem(meta) {
    var self = this;
    _.extend(self, meta);

    self.name = self.name || "";
    self.type = self.type || "movie";

    self.removed = self.hasOwnProperty("removed") ? self.removed : false;

    self.state = self.state || { };


    self.hash = function()
    {
        // if (self.type=="other") return [self._id, self.state.file_id].filter(function(x) { return x }).join(" ");
        if (self.type=="channel") return [self._id, self.state.video_id].join(" ");
        return (self.type == "series") ? [self._id, self.state.season, self.state.episode].join(" ") : self._id
    };
    
    self.getQuery = function() {
        return _.extend({ type: this.type }, metadata.getIdFromStr(this._id));
    }

    self.requestQuery = function() {
        if (self.type=="channel") return { yt_id: self.state.video_id, type: "channel" };
        
        return _.extend(metadata.getIdFromStr(self._id), self.type=="series"
            ? { type: "series", episode: self.state.episode || 1, season: self.state.season || 1 }
            : { type: self.type });
    };

    self.title = function(meta) {
        var subtitle = "";
        if (this.type == "series" && this.state.season) subtitle = ("season "+this.state.season+", episode "+this.state.episode);
        if (this.type == "series" && meta && Array.isArray(meta.episodes)) {
            var ep = meta.getEpisode(this.state.season, this.state.episode);
            if (ep) subtitle = ep.name + " ("+this.state.season+"x"+this.state.episode+")";
        };
        if (this.type == "channel" && meta && Array.isArray(meta.uploads)) {
            var vid = meta.getVideo(this.state.video_id);
            if (vid) subtitle = vid.title;
        };
        
        // if (!subtitle && notif && notif.title) subtitle = notif.title;

        return this.name + ( subtitle ? " - "+subtitle : "")
    };

    // self.metaQuery

};


libraryItem.addToLib = function() {
    // TODO
};

libraryItem.removeFromLib = function() {
    // TODO
}

libraryItem.load = function() {
    // TODO
};

libraryItem.fromMeta = function(meta) {
    return new libraryItem({ 
        _id: meta._id || meta.imdb_id,
        name: meta.name, type: meta.type
    });
}


module.exports = libraryItem;
