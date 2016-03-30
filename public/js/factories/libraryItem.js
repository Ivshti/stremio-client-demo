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

    self.requestQuery = function() {
        if (self.type=="channel") return { yt_id: self.state.video_id, type: "channel" };
        
        return _.extend(metadata.getIdFromStr(self._id), self.type=="series"
            ? { type: "series", episode: self.state.episode || 1, season: self.state.season || 1 }
            : { type: self.type });
    };

    // self.title
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