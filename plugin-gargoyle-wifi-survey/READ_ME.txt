/*
TODO:
¥ there was an odd sh: 300: bad number error & sh -x /usr/lib/gargoyle/survey.sh didn't pinpoint a problem area (only happend once)

ENHANCEMENTS:
Transition to away from iwlist to (faster & richer) iw output
*/

/* in this table:

  Stock 'iw' & 'iwlist' scans have their output scraped. Most data comes fom iwlist - iw provides 802.11n capabilities & speeds.
  Data is formatted as a javascript array using /usr/lib/gargoyle/survey.sh which echos the data at the end of a run.
  iwlist & iw scans take some time, so there is a delay from table drawing to updated data. Sorry, asynchronous javascript to blame.
  Quality is represented as the bar on right, color coded for <.333, .333 - .666, >.666

  Vendor lookup starts with a 2.8MB file from here: http://standards.ieee.org/develop/regauth/oui/oui.txt
  Data is scraped with this command:
  
	echo "var vdr=new Array();" > ~/Desktop/OUIs.js && grep -e "(base 16)" ~/Desktop/oui.txt | sed 's/\"/\\\"/g' | sed 's/\//\\\//g' | awk '{printf "vdr.push([\""$1"\",\""} {for(i=4;i<=NF;++i) printf("%s",  $i) } {printf "\"]);\n"}' >> ~/Desktop/OUIs.js
	
  OUIs.js is now 775kb & chock full o' vendors (17,500+ lines) in a javascript array; no 775kb file should go onto the router flash chip, but... RAM is a different story. Take that OUIs.js and copy it to /tmp and the wifi_survey.sh webpage will pull it from the /tmp directory & present it to the browser. Or on an attached USB drive.

*/

/* version history
v1.0 	initial release
v1.0.1	survey.sh bugfix for 45 days
v1.0.2	survey.sh: scrape N speeds from iw; added # stations tracked
v1.0.3	when starting up on routers with > 10MB on tmpfs, ewget OUIs.js directly from gitbub
v1.1	add a single button that downloads OUIs.js to RAM/USB (+ optional /etc/rc.local script injection) & removes OUIs.js;
		another 45 day bugfix; check+indicate when wifi is down; show >1 encryption methods; >N600 speeds are streamsx150 (the HP fix)
*/