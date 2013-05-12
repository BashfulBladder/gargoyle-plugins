/*
	This program is copyright 2013 BashfulBladder and is distributed under the terms of the GNU GPL 
	version 2.0 with a special clarification/exception that permits adapting the program to 
	configure proprietary "back end" software provided that all modifications to the web interface
	itself remain covered by the GPL. 
	See http://gargoyle-router.com/faq.html#qfoss for more information
*/
var svgNS = "http://www.w3.org/2000/svg"
var y_unit=6.92; // 900/130
var ChSignalHigh = new Array();

/*
	Note: in this chart (0,0) is in the top left corner; (1000,1000) is the bottom right corner

*/

function GetChannelInfo(charray, supplemental_data) {
	if (supplemental_data != null) {
		return charray[1];
	}
	return charray[0];
}

function VerifyUniqColor(stations, rColor,gColor,bColor) {
	var uniqueness = stations.length < 50 ? 31 : 12;
	for (var i = 0; i<stations.length; i++) {
		if (stations[i].length == 5) {
			var existingR = parseInt(stations[i][4].substr(1,2),16);
			var existingG = parseInt(stations[i][4].substr(3,2),16);
			var existingB = parseInt(stations[i][4].substr(5,2),16);
			
			// if the values are within 5% of each other
			if (Math.abs(rColor-existingR) < uniqueness && Math.abs(gColor-existingG) < uniqueness && Math.abs(bColor-existingB) < uniqueness) {
				return 0
			}
		}
	}
	return 1
}

function GenColor(stations) {
	function colorcode() { return Math.floor(Math.random()*256); }
	function hexus(num) { return num < 16 ? "0" + num.toString(16) : num.toString(16) }
	var rColor=0;
	var gColor=0;
	var bColor=0;
	while (rColor+gColor+bColor < 256) {
		rColor=colorcode();
		gColor=colorcode();
		bColor=colorcode();
		
		if (VerifyUniqColor(stations, rColor,gColor,bColor) == 0) {
			rColor=0; gColor=0; bColor=0;
		}
	}
	return "#" + hexus(rColor) + hexus(gColor) + hexus(bColor);
}

function GetHeightFromSignal(signal_level) { //a signal_level > 0 is useful in a tall stack of station names
	return (signal_level > 0 ? (signal_level*y_unit)*-1 : Math.abs(signal_level)*y_unit)
}

function GetChannelCenter(channel) {
	var achannel=document.getElementById("Ch"+channel);
	if (achannel == null) { return null }
	var chann_tmatrix = achannel.getCTM();
	return chann_tmatrix.e/chann_tmatrix.d -50
}

function GetTierNoiseFloorCoord(tier, x_point) {
	if (x_point < 45) { x_point = 0; }
	if (x_point > 855) { x_point = 855; }
	
	var nfpath = document.getElementById("NoiseFloorPath"+tier);
	if (nfpath == null) { return null }
	var nflength = nfpath.getTotalLength();
	var nfcoord=nfpath.getPointAtLength(0);
	for (var i=0; i<nflength; i++) {
		nfcoord=nfpath.getPointAtLength(i);
		if (Math.round(nfcoord.x) == Math.round(x_point)) {
			return nfcoord.y;
		}
	}
	return GetHeightFromSignal(-120);
}

//xpoint=-99999 will provide the initial y coordinate; xpoint=99999 will provide the terminal y coordinate
function GetStationYCoord(stationID, x_point) {
	var stapath = document.getElementById(stationID);
	var stalength = stapath.getTotalLength();
	var stacoord=stapath.getPointAtLength(0);
	if (x_point == 99999) {
		return stapath.getPointAtLength(stalength).y;
	}
	if (x_point == -99999) {
		return stapath.getPointAtLength(0).y;
	}
	for (var i=0; i<stalength; i++) {
		stacoord=stapath.getPointAtLength(i);
		if (Math.round(stacoord.x) == Math.round(x_point)) {
			return stacoord.y;
		}
	}
	return GetHeightFromSignal(-120);
}

function GeneratePolygonElement(points, fill, opacity) {
	var apoly=document.createElementNS(svgNS, "polygon");
	apoly.setAttributeNS(null, "points", points);
	apoly.setAttributeNS(null, 'fill', fill);
	apoly.setAttributeNS(null, 'opacity', opacity);
	return apoly;
}

function GeneratePathElement(swidth, pcolor, fcolor, fopacity, pathdata) {
	var apath = document.createElementNS(svgNS, "path");
	apath.setAttributeNS(null, 'stroke', pcolor);
	apath.setAttributeNS(null, 'stroke-width', swidth);
	apath.setAttributeNS(null, 'stroke-linejoin', "round");
	apath.setAttributeNS(null, 'd', pathdata);
	apath.setAttributeNS(null, 'fill', fcolor);
	apath.setAttributeNS(null, 'opacity', fopacity);
	return apath;
}

function GenerateLineElement(x2len, y2len, stroke_width, stroke_color) {
	var aline = document.createElementNS(svgNS, "line");
	aline.setAttribute("x2", x2len);
	aline.setAttribute("y2", y2len);
	aline.setAttributeNS(null, 'stroke-width', stroke_width);
	aline.setAttributeNS(null, 'stroke', stroke_color);
	return aline;
}

function GenerateTextElement(xloc, yloc, trans_vars, anchor, content, fsize, fstyle) {
	var tElement=document.createElementNS(svgNS, "text");
	tElement.setAttribute("x", xloc);
	tElement.setAttribute("y", yloc);
	tElement.setAttribute("transform", trans_vars);
	tElement.setAttribute("text-anchor", anchor);
	tElement.textContent = content;
	tElement.setAttribute("font-size", fsize);
	tElement.setAttribute("style", fstyle);
	return tElement;
}

function GetNoiseInChannel(channel) {
	for (var i=0; i<ChSignalHigh.length; i++) {
		if (channel == ChSignalHigh[i][1]) {
			return GetHeightFromSignal(ChSignalHigh[i][2]);
		}
	}
	return GetHeightFromSignal(-120);
}

function FindNoiseInTier(tier, channel_position) { //[1,36,-95,-120,""]
	var channel=(channel_position==0 ? 200 : 0);
	for (var i=0; i<ChSignalHigh.length; i++) {
		if (ChSignalHigh[i][0] == tier) {
			if (channel_position == 0 && ChSignalHigh[i][1] < channel) {
				channel=ChSignalHigh[i][1];
			} else if (channel_position == 1 && ChSignalHigh[i][1] > channel) {
				channel=ChSignalHigh[i][1];
			}
		}
	}
	return channel;
}

function GetTierForChannel(channel) {
	for (var i=0; i<ChSignalHigh.length; i++) {
		if (channel==ChSignalHigh[i][1]) {
			return ChSignalHigh[i][0]
		}
	}
	return null
}

function AssertTier(tier) {
	for (var i=0; i<ChSignalHigh.length; i++) {
		if (tier==ChSignalHigh[i][0]) {
			return ChSignalHigh[i][0]
		}
	}
	return null
}

function GetChannelRecordIndex(channel) {
	for (var i=0; i<ChSignalHigh.length; i++) {
		if (channel==ChSignalHigh[i][1]) {
			return i
		}
	}
	return null
}

function GetChannelWidth(tier, channel) {
	if (GetTierForChannel((channel+4)) != null) {
		return GetChannelCenter((channel+4))-GetChannelCenter(channel)
	} else if (GetTierForChannel((channel-4)) != null) {
		return GetChannelCenter(channel)-GetChannelCenter((channel-4))
	}
}

function GetTierWidth(tier) {
	var channels=0;
	for (var i=0; i<ChSignalHigh.length; i++) {
		if (tier==ChSignalHigh[i][0]) { channels++; }
	}
	return (channels*(930/(channels < 8 ? 8 : channels)));
}

function GetNextChannel(tier, channel) { //[3,157,-97,-120]
	for (var i=0; i<ChSignalHigh.length; i++) {
		if (tier == ChSignalHigh[i][0]) {
			if (channel==ChSignalHigh[i][1]) { //if sort in wifi_survey.js did its job, the first one is the lowest channel in the tier
				if (i+1 < ChSignalHigh.length) {
					if (tier == ChSignalHigh[i+1][0]) {
						return ChSignalHigh[i+1][1]
					}
				}
			} else if (channel == null) {
				return ChSignalHigh[i][1]
			}
		}
	}
	return null
}

function plotNoiseFloor(noise) {
	var initial_chan=0;
	var terminal_chan=0;
	
	for (var tier = 1; tier <= 3; tier++) {
		initial_chan=FindNoiseInTier(tier,0);
		terminal_chan=FindNoiseInTier(tier,1);
		var inNoiseX = 0;
		var inNoiseY = GetNoiseInChannel(initial_chan);
		var nline="M"+inNoiseX+","+inNoiseY;
		
		for (var ch=0; ch < ChSignalHigh.length; ch++) {
			if (ChSignalHigh[ch][0] == tier) {
				var anoiseX = GetChannelCenter(ChSignalHigh[ch][1]);
				var anoiseY = GetHeightFromSignal(ChSignalHigh[ch][2]);
				nline+=" c"+(anoiseX-inNoiseX)/2+","+"0" /* x1,y1; x is 1/2 way to endpoint, no y-axis change */
					+","+(anoiseX-inNoiseX)/2+","+(anoiseY-inNoiseY) /* x2,y2 */
					+","+(anoiseX-inNoiseX)+","+(anoiseY-inNoiseY) /* endx,endy */
					+" ";
				inNoiseX=anoiseX;
				inNoiseY=anoiseY;
			}
		}
		nline+="L"+950+","+inNoiseY; //I think its better to hide the bottom flare than to be correct & end at the DFS
		
		var thisTier=document.getElementById("T"+tier+"ChartG");
		if (thisTier == null) { continue; }
		
		var nfpath = GeneratePathElement(5, "#ffffff", "transparent", 1.0, nline);
		nfpath.id="NoiseFloorPath"+tier;
		thisTier.appendChild(nfpath);
		var nffillpath = GeneratePathElement(0, "#ffffff", "#444444", 0.8, nline+ "V830 H0");
		nffillpath.id="NoiseFloorFill"+tier;
		thisTier.appendChild(nffillpath);
	}
}

function plotStations(stations) {
	for (var i = 0; i<stations.length; i++) {
		var stchannel=GetChannelInfo(stations[i][1]);
		if (stchannel < 30) { continue; } //stations contains 2.4GHz & 5GHz data
		
		var ch_tier = GetTierForChannel(stchannel);
		if (ch_tier == null) { continue }
		var next_channel = GetTierForChannel((stchannel+4));
		var signal_height = GetHeightFromSignal(stations[i][3]);
		var channel_center = GetChannelCenter(stchannel);
		var container=document.getElementById("T"+ch_tier+"ChartG");
		var chanWidth = GetChannelWidth(ch_tier, stchannel)
		
		var chanSpread = chanWidth * 0.8125; /* 16.25MHz utilized / 20MHz */
		var chanSpreadW = 0;
		var leadingNoise = GetTierNoiseFloorCoord(ch_tier, channel_center-(chanSpread*0.6) );
		var trailingNoise = GetTierNoiseFloorCoord(ch_tier, channel_center+(chanSpread*0.6) );
		
		//flatline leading part of signal that is at or under the noisefloor; for stations that
		//have disappeared from the current survey, but are tracked for x minutes & the noise floor rose
		if (signal_height > leadingNoise) { leadingNoise = signal_height; }
		
		var spath="";
		if (GetChannelInfo(stations[i][1],1) == "+") {
			chanSpreadW = chanWidth * 1.6875;
			spath+="M"+(channel_center-(chanSpread*0.6)) +","+leadingNoise;
			trailingNoise = GetTierNoiseFloorCoord(ch_tier, channel_center+(chanSpread*0.6)+(chanSpreadW-chanSpread));
		} else if (GetChannelInfo(stations[i][1],1) == "-") {
			chanSpreadW = chanWidth * 1.6875;
			leadingNoise = GetTierNoiseFloorCoord(ch_tier, channel_center-(chanSpread*0.6)-(chanSpreadW-chanSpread));
			if (signal_height > leadingNoise) { leadingNoise = signal_height; }
			spath+="M"+(channel_center-(chanSpread*0.6)-(chanSpreadW-chanSpread)) +","+leadingNoise;
		} else {
			chanSpreadW=0;
			spath+="M"+(channel_center-(chanSpread*0.6)) +","+leadingNoise;
		}
		
		//flatline trailing part of signal that is at or under the noisefloor; for stations that
		//have disappeared from the current survey, but are tracked for x minutes & the noise floor rose
		if (signal_height > trailingNoise) { trailingNoise = signal_height; }
		
		spath+= " c"+(chanWidth*0.0825)+","+((signal_height-leadingNoise)*0.333) /* x1,y1 */
						+","+(chanWidth*0.0825)+","+((signal_height-leadingNoise)*0.666) /* x2,y2 */
						+","+(chanWidth*0.0825)+","+(signal_height-leadingNoise) /* endpoint */
						+" ";
			
		spath+="l"+(chanSpreadW==0 ? chanSpread : chanSpreadW)+","+"0";
		spath+= " c"+"0,"+Math.abs((signal_height-trailingNoise)*0.666) /* x1,y1 */
						+","+(chanWidth*0.0825)+","+Math.abs(signal_height-trailingNoise) /* x2,y2 */
						+","+(chanWidth*0.0825)+","+Math.abs(signal_height-trailingNoise) /* endpoint */
						+" ";
		var scolor=GenColor(stations);
		
		var stpath = GeneratePathElement(5, scolor, "transparent", 1.0, spath);
		stpath.id="StationPath_"+i;
		container.appendChild(stpath);
		
		//for the fill ONLY, generate sweeping path data into the noise floor
		var chan_noisebase_y_delta=GetHeightFromSignal(-120)-GetStationYCoord(stpath.id, 99999);
		var chan_noisebase_x_spread = (chan_noisebase_y_delta/4) + chanWidth;
		
		spath+=" c"+"0"+","+(chan_noisebase_y_delta*0.333) /* x1,y1 */
					+","+(chan_noisebase_x_spread*0.165)+","+chan_noisebase_y_delta /* x2,y2 */
					+","+chan_noisebase_x_spread+","+chan_noisebase_y_delta /* endpoint */
					+" ";
		spath+="l"+chan_noisebase_x_spread * (chanSpreadW==0 ? -2.7825 : -3.335)+","+"0";
		
		var return_x=(chan_noisebase_x_spread*(chanSpreadW==0?2.75:3.335))
						-(chan_noisebase_x_spread+(chanSpreadW==0?chanSpread:chanSpreadW))-chanWidth*0.15;
		chan_noisebase_y_delta=GetHeightFromSignal(-120)-GetStationYCoord(stpath.id, -99999);
		spath+=" c"+return_x*0.33+",0" /* x1,y1 */
					+","+return_x+",-"+(chan_noisebase_y_delta*0.165) /* x2,y2 */
					+","+return_x+",-"+chan_noisebase_y_delta /* endpoint */
					+" ";
		var stpathFill = GeneratePathElement(0, scolor, scolor, 0.3, spath);
		container.appendChild(stpathFill);
		
		if (stations[i][3] > ChSignalHigh[GetChannelRecordIndex(stchannel)][3]) {
			ChSignalHigh[GetChannelRecordIndex(stchannel)][3] = parseInt(stations[i][3]);
		}
		stations[i].push(scolor);
	}
}	

//ChSignalHigh allows matching a channel to a tier. Initially iter, channel & noise floor are stored.
//As each station is plotted, the station with the highest signal is stored in the terminal member; -120 here
//[ [1,36,-95,-120],[2,100,-93,-120],[3,157,-97,-120]       ]
function InitChannelHighs(tier, noise_floor_ltd) {
	for (var i=0; i<noise_floor_ltd.length; i++) {
		ChSignalHigh.push([tier, noise_floor_ltd[i][0], noise_floor_ltd[i][2], -120]);
	}
}

function GenChartYLabel() { //if tier 2 exists, label only tier 2; otherwise label tier1&3
	for (var tier=1; tier<=3; tier++) {
		var a_tier=document.getElementById("Y"+tier+"_label");
		if (((tier ==1 || tier ==3) && AssertTier(2) != null) || a_tier == null) { continue }
		var ylabel=GenerateTextElement(-115, 10, "rotate(-90) matrix(3 0 0 1 0 0)", "middle", "Signal Level (in dbm)", "16px", "");
		ylabel.setAttribute("dy", "-45px");
		a_tier.appendChild(ylabel);
	}
}

function FullChannelCount(tier_noise) {
	var counter = 0;
	var prev_channel = 0;
	for (var i=0; i<tier_noise.length; i++) {
		if (i == 0) {
			prev_channel = tier_noise[i][0];
			if (tier_noise[i+1][0]-prev_channel >= 4) { counter++; }
		} else if (tier_noise[i][0]-prev_channel >= 4) {
			prev_channel=tier_noise[i][0];
			counter++;
		}
	}
	return counter;
}

function InitTiers(chart_size, parentElement, tier, tier_noise) {
	var chart_width = 930;
	var fullchannels=FullChannelCount(tier_noise);
	var channel_width = chart_width / (fullchannels < 8 ? 8 : fullchannels);
	var gXaxis = document.createElementNS(svgNS, "g");
	var gYaxis = document.createElementNS(svgNS, "g");
	var xlabel=GenerateTextElement(450, 10, "", "middle", "Channel", "22px", "");
	var tierW=GetTierWidth(tier); //its a little much to use this *here*...
	var overlapping_channels = 0;
	xlabel.setAttribute("dy", "20px");
	gXaxis.setAttribute("transform", "translate(0,"+((300*(tier)+(tier)*35)-45)+")");
	gXaxis.appendChild(xlabel);
	
	for (var i=0; i<tier_noise.length; i++) {
		var gchannel = document.createElementNS(svgNS, "g");
		var gtick = document.createElementNS(svgNS, "g");
		
		if (GetChannelRecordIndex(tier_noise[i][0]+2) != null) {
			gchannel.setAttribute("transform", "translate("+ (channel_width*(i*0.5)+(channel_width*0.25)) +",0)");
			gtick.setAttribute("transform", "translate("+ (channel_width*(i+1))*0.5 +",-10)");
			overlapping_channels++;
		} else if (GetChannelRecordIndex(tier_noise[i][0]-2) != null) {
			gchannel.setAttribute("transform", "translate("+ (channel_width*(i*0.5)+(channel_width*0.325)) +",0)");
			gtick.setAttribute("transform", "translate("+ (channel_width*(i+1.5))*0.5 +",-10)");
			overlapping_channels+=0.5;
		} else {
			gchannel.setAttribute("transform", "translate("+ (channel_width*(i-overlapping_channels*0.5)+(channel_width*0.5)) +",0)");
			gtick.setAttribute("transform", "translate("+ channel_width*((i-overlapping_channels*0.5)+1) +",-10)");
		}
		
		var channelmarker=GenerateTextElement(0, 10, "", "middle", tier_noise[i][0], "20px", "");
		channelmarker.id="Ch"+tier_noise[i][0];
		
		var tickline=GenerateLineElement(0, 6, "1px", "#ffffff")
		
		gchannel.appendChild(channelmarker);
		gtick.appendChild(tickline);
		
		gXaxis.appendChild(gchannel);
		gXaxis.appendChild(gtick);
	}

	gYaxis.setAttribute("transform", "translate(0,"+(300*(tier-1)+(tier-1)*35)+") matrix(1 0 0 0.333 0 0)"); ///0, 333, 666
	gYaxis.id="Y"+tier+"_label";
	
	for (var j=0; j<=120; j+=10) {
		var gStick = document.createElementNS(svgNS, "g");
		gStick.setAttribute("transform", "translate(0,"+ ((900/13)*(j/10))+")");
		
		var signalmarker=GenerateTextElement(-15, 10, "matrix(0.333 0 0 1 0 0)", "end", (j==0 ? "" : "-")+j, "48px", "");
		
		var tickline=GenerateLineElement((tierW > 900 ? tierW+20 : tierW), 0, "1px", "#ffffff");
		tickline.id="T"+tier+"S-"+j;
		
		gStick.appendChild(signalmarker);
		gStick.appendChild(tickline);
		gYaxis.appendChild(gStick);
	}
	
	var gTiers = document.createElementNS(svgNS, "g");
	gTiers.id="T"+tier+"ChartG";
	gYaxis.appendChild(gTiers); // we want the translate & transform matrix to apply to charting data
	
	parentElement.appendChild(gXaxis);
	parentElement.appendChild(gYaxis);
}

function InitBand(chart_size, parentElement, available_channels) {
	var tier_lowest_channel = 0;
	var tier_noise = null;
	var tier = 0;
	
	for (var i=0; i<available_channels.length; i++) {
		if (available_channels[i][0] > 30 && i == 0) {
			tier_lowest_channel=i;
		} else if (available_channels[i][0] > 99 && tier_noise == null) {
			tier_noise=available_channels.slice(tier_lowest_channel, i);
			InitChannelHighs(1, tier_noise);
			InitTiers(chart_size, parentElement, ++tier, tier_noise);
			tier_lowest_channel=i;
		} else if (available_channels[i][0] >= 132 && tier == 1 && (available_channels.length-i) > 5) {
			tier_noise=available_channels.slice(tier_lowest_channel, i);
			InitChannelHighs(2, tier_noise);
			InitTiers(chart_size, parentElement, ++tier, tier_noise);
			tier_lowest_channel=i;
		} else if (i+1 == available_channels.length) {
			tier_noise=available_channels.slice(tier_lowest_channel);
			InitChannelHighs(3, tier_noise);
			InitTiers(chart_size, parentElement, 3, tier_noise);
		}
	}
	GenChartYLabel();
}

//deletes all channel data for nth run (all new colors, new noise floor & stations) for all 3 tiers
function ClearChart(parentElement) {
	while (parentElement.lastChild) {
		parentElement.removeChild(parentElement.lastChild);
	}
	ChSignalHigh.length=0;
}

function bringNoiseForward() {
	for (var tier = 1; tier <= 3; tier++) {
		var aTier = document.getElementById("T"+tier+"ChartG");
		if (aTier == null) { continue }
		var anpathE = document.getElementById("NoiseFloorPath"+tier);
		var anfillE = document.getElementById("NoiseFloorFill"+tier);
		aTier.removeChild(anpathE);
		aTier.removeChild(anfillE);
		aTier.appendChild(anpathE);
		aTier.appendChild(anfillE);
	}
}

//1st for loop drops lines from highest signal in each channel (above background noise) as an indicator of channel assignment
//2nd for loop adds station BSSIDs text labels from lowest signal level to highest (already sorted by wifi_survey.js)
function GenerateLabels(stations) { //[1,36,-95,-86]
	for (var i = 0; i<ChSignalHigh.length; i++) {
		if (ChSignalHigh[i][3] > -120) {
			var chassL="M" + GetChannelCenter(ChSignalHigh[i][1])+","+GetHeightFromSignal(ChSignalHigh[i][3])
						+"l0,"+(GetHeightFromSignal(-120)-GetHeightFromSignal(ChSignalHigh[i][3]));
			var chassPE=GeneratePathElement(2, "#cccccc", "transparent", 0.6, chassL);
			var aTier = document.getElementById("T"+ChSignalHigh[i][0]+"ChartG");
			aTier.appendChild(chassPE);
		}
	}
	
	for (var j = stations.length-1; j> -1; j--) {
		var stchannel=GetChannelInfo(stations[j][1]);
		if (GetTierForChannel(stchannel) == null) { continue }
		if (stchannel < 30) { continue; } //stations contains 2.4GHz & 5GHz data
		var thisChannelInfo=ChSignalHigh[GetChannelRecordIndex(stchannel)];
		
		thisChannelInfo[3]+=5;
		var aTier = document.getElementById("T"+thisChannelInfo[0]+"ChartG");
		var textContainer = document.createElementNS(svgNS, "g");
		textContainer.setAttribute("transform", "translate("+ GetChannelCenter(stchannel) +","+ GetHeightFromSignal(thisChannelInfo[3])+")"); //this group element is subject to the transform of the parent tier; the text children will then be able to be in the correct location because of this elements translate, but the text element's transform matrix will unsquash the text
		
		var stextE = GenerateTextElement(0, 0, "matrix(1 0 0 3 0 0)", "middle", stations[j][0], "26px", "fill:#000000;");
		stextE.setAttribute("filter","url(#blur1)");
		var stextE2 = GenerateTextElement(0,0, "matrix(1 0 0 3 0 0)", "middle", stations[j][0], "26px", "text-shadow: 2px 2px 5px #000000; fill:"+stations[j][4]);
		
		textContainer.appendChild(stextE);
		textContainer.appendChild(stextE2);
		aTier.appendChild(textContainer);
		thisChannelInfo[3]+=6;
		if(stations[j].length > 3) { stations[j].pop(); } //gets rid of the appended color code
	}
}

function GenerateChannelSeparators() {
	for (var tier = 1; tier <= 3; tier++) {
		var achannel=GetNextChannel(tier);
		var next_channel=GetNextChannel(tier,achannel);
		
		do {
			if (next_channel-achannel > 4) {
				var aTier=document.getElementById("T"+tier+"ChartG");
				var channel_width=GetChannelWidth(tier, achannel);
				var channel_center=GetChannelCenter(achannel);
				var tickL=(channel_center+(channel_width*0.5));
				
				var points=""+(tickL-10)+",-10 "+(tickL+10)+",-10 "+(tickL+10)+","+GetHeightFromSignal(-115)+
							" "+tickL+","+GetHeightFromSignal(-120)+
							" "+(tickL-10)+","+GetHeightFromSignal(-115)+" "+(tickL-10)+",-10"
				var gapPoly=GeneratePolygonElement(points, "#222222", 0.9);
				aTier.appendChild(gapPoly);
			}
			achannel=next_channel;
			next_channel=GetNextChannel(tier,achannel);
		} while (next_channel != null)
	}
}

function plotBand(chart_size, noise, stations) {
	var svgChart = document.getElementById("chartarea");
	ClearChart(svgChart);
	InitBand(chart_size, svgChart, noise);
	plotNoiseFloor(noise);
	plotStations(stations);
	
	bringNoiseForward();
	GenerateChannelSeparators();
	GenerateLabels(stations);
	//thinking I won't generate a backer for 5GHz
}
