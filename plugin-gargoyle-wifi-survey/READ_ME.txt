/*
TODO:
SVG charts: 5GHz (channel gaps make a non-continuous graph through available channels)

SVG charts: I think broadcom platform is going to have an issue: iw doesn't come installed by default; iw is required for noise floor (although there may be another avenue, I dun't know), without a noise floor, broadcom charting is probably going to look whack

ENHANCEMENTS:
Transition away from iwlist to (faster & richer) iw output

SVG charts: colors jump around every 2 minutes when data is reloaded; maybe find a way to generate a color in survey.sh
			upside: color is consistent through updates; downside: ugly/dark colors persist forever

*/

/* in this table:

  Stock 'iw' & 'iwlist' scans have their output scraped. Most data comes fom iwlist - iw provides 802.11n capabilities & speeds.
  Data is formatted as a javascript array using /usr/lib/gargoyle/survey.sh which echos the data at the end of a run.
  iwlist & iw scans take some time, so there is a delay from table drawing to updated data. Sorry, asynchronous javascript to blame.
  Quality is represented as the bar on right, color coded for <.333, .333 - .666, >.666 (for platforms with iwlist only)
  The bar on the right with iw available has a noise floor data. The bar represents the Signal-to-Noise ratio.

  Vendor lookup starts with a 2.8MB file from here: http://standards.ieee.org/develop/regauth/oui/oui.txt
  Data is scraped with this command:
  
	echo "var vdr=new Array();" > ~/Desktop/OUIs.js && grep -e "(base 16)" ~/Desktop/oui.txt | sed 's/\"/\\\"/g' | sed 's/\//\\\//g' | awk '{printf "vdr.push([\""$1"\",\""} {for(i=4;i<=NF;++i) printf("%s%s",  $i, i==NF?"":" ") } {printf "\"]);\n"} >> ~/Desktop/OUIs.js
	
  OUIs.js is now 803kb & chock full o' vendors (17,500+ lines) in a javascript array; no 803kb file should go onto the router flash chip, but... RAM is a different story. Take that OUIs.js and copy it to /tmp and the wifi_survey.sh webpage will pull it from the /tmp directory & present it to the browser. Or on an attached USB drive.

*/

/* SVG chart note:

  As I no longer use the default Gargoyle theme, I am not bound by the (retarded) 500px width limit in Gargoyle html pages of content.
  Mercifully, as this plugin is not in the Gargoyle repository, a broader view reduces all that irritating empty space on a page.
  
  The chart only displays data when current wireless data is fetched from the router. Stale data 6 hours old has little value in setting
  up your current channels.

*/

/* version history
v1.0 	initial release
v1.0.1	survey.sh bugfix for 45 days
v1.0.2	survey.sh: scrape N speeds from iw; added # stations tracked
v1.0.3	when starting up on routers with > 10MB on tmpfs, ewget OUIs.js directly from gitbub
v1.1	add a single button that downloads OUIs.js to RAM/USB (+ optional /etc/rc.local script injection) & removes OUIs.js;
		another 45 day bugfix; check+indicate when wifi is down; show >1 encryption methods; >N600 speeds are streamsx150 (the HP fix)
V1.1.1	move to iw noise floor & SNR to represent signal quality (iw seems to be the only 'noise' game in town; max display is 60dbm SNR)
v1.1.2	(Cezary/obsy) fixed bug when USB/samba/ftp support was not present [webpage]; similar fix in makefile/postrm
v1.2	inital 2.4GHz svg chart of station distribution, noise & signal levels
v1.2.1	OUIs.js: fix missing spaces (thanks Cezary)
		survey.sh: iw scrape for 40MHz channels
		SVG chart: add (missing) copyright&license; plot fill into noisefloor (fixes some bizarre void fills); text dropshadows (not no easy in Firefox) which sadly only marginally help; add 802.11b signal shape + 40MHz channels
*/