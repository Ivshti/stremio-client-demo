# stremio-addons-client
An example client to the Stremio add-ons protocol, similar to Stremio's Discover
![Stremio add-ons client](/screenshots/stremio-addons-client.png)

## What's this?
It's an example client of the [stremio-addons](http://github.com/Stremio/stremio-addons) system (which is a multi-client RPC lib). 
It mimics Stremio's Discover interface, and shows all available streams gathered from all add-ons for a selected movie/series/channel/etc.

**The main purpose of this is to aid developers in creating their own Stremio add-on by showing them how the actual app(s) utilize the add-on client.**

## How to run
```bash
git clone http://github.com/Stremio/stremio-addons-client
cd stremio-addons-client
npm install
npm start
# open browser at http://localhost:9900
```

##### Open your browser at http://localhost:9900/#?addon=ADDON_URL for your own end-point

## What are Stremio add-ons

**Stremio add-ons extend Stremio with content.**

That means either adding items to Discover or providing sources to stream content from.

Unlike regular software plugins, Stremio addons **do not run inside Stremio**, but instead are **accessed through HTTP over network**. You can think of them as **RSS on steroids**. Multiple addons can be activated, providing you more content, without any installation / security risks.


## Does it use the same logic as the desktop app?
**Yes, the absolutely same logic, except**:

1. Stremio has a user log-in, and utilizes only the enabled add-ons by the user. This utilizes all add-ons served by the tracker.
2. The desktop app caches received results in [linvodb](http://github.com/Stremio/linvodb3), while this always loads them on demand

**But all in all, if an add-on works here, it should work on the desktop app and the mobile app.**

## Can I see example add-ons?

[Guidebox add-on](http://github.com/Stremio/guidebox-stremio)

[Filmon.tv add-on](http://github.com/Stremio/filmon-stremio)

Coming soon: public domain movies, YouTube channels

