# stremio-addons-client
An example client to the Stremio add-ons protocol, similar to Stremio's Discover. Because the desktop app is nothing more but a client to the add-ons system, this is basically **an open-source Stremio**.
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

That means either adding items to Discover or providing sources to stream content farom.

Unlike regular software plugins, Stremio addons **do not run inside Stremio**, but instead are **accessed through HTTP over network**. You can think of them as **RSS on steroids**. Multiple addons can be activated, providing you more content, without installation or security risks.


## Does it use the same logic as the desktop app?
**Yes, the absolutely same logic, except**:

1. Stremio has a user log-in, and utilizes only the enabled add-ons by the user. This utilizes all add-ons served by the tracker.
2. The desktop app caches received results in [linvodb](http://github.com/Stremio/linvodb3), while this always loads them on demand

**But all in all, if an add-on works here, it should work on the desktop app and the mobile app.**

## Can I see example add-ons?

[Hello World add-on](https://github.com/Ivshti/addon-helloworld)

[Vodo add-on](https://github.com/Ivshti/stremio-vodo)

[Guidebox add-on](http://github.com/Stremio/guidebox-stremio)

[Filmon.tv add-on](http://github.com/Stremio/filmon-stremio)

You can see all known hosted Stremio add-ons at [addons.strem.io](http://addons.strem.io)


## How to create my own add-on?
### [Follow the guidelines here.](https://github.com/Stremio/stremio-addons/blob/master/documentation/home.md)

## How to use this to test my add-on

You can and should use this module to test your add-on before trying it in Stremio, because this module is open-source and you can see what calls it makes to your add-on and why.

To **enable your add-on**, add it's local endpoint (e.g. http://localhost:5555) via the bar on the bottom of the Add-ons tab:

![Enable custom add-on](/screenshots/enable-addon.png)
