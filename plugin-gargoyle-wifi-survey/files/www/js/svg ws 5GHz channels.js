/*
	This program is copyright 2013 BashfulBladder, distributed under the GNU GPLv2.0 
	See http://gargoyle-router.com/faq.html#qfoss for more information
*/

var svgNS = "http://www.w3.org/2000/svg"
var y_unit=6.92; // 900/130
var ChSignalHigh = new Array();

/*
	Note: in this chart (0,0) is in the top left corner; (1000,1000) is the bottom right corner
	Note2: some hardcoded numbers differ from the 2.4GHz chart - usually accounted for by the scaling of the y axis by 33%
*/

//
//  GetNoiseInChannel returns the noise floor level in the center of the channel
//  only used for start & end points of the noise floor; the noise floor begins at the x=0 with the noise from the first channel
//  the value is stored in the 3rd element of the ChSignalHigh array (-95 in this example: [1,36,-95,-120,""])
//  returns a y coordinate for the noise floor at the center of the channel
//
function GetNoiseInChannel(channel) {
	for (var i=0; i<ChSignalHigh.length; i++) {
		if (channel == ChSignalHigh[i][1]) {
			return GetHeightFromSignal(ChSignalHigh[i][2]);
		}
	}
	return GetHeightFromSignal(-120);
}

//
//  FindChannelInTier returns the start/end channel in the tier
//    tier is 1-3 (some may not be present)
//    channel_position is the first channel in the tier or the last; values are 0 or something else for last
//  loop through the ChSignalHigh elements (example: [1,36,-95,-120,""]) and matches tier with the 1st element
//  in a matching tier, to find the start (lowest) channel, start with 200 & find channels lower (ChSignalHigh's 2nd element)
//  in a matching tier, to find the end (highest) channel, start with 0 & find channels higher (ChSignalHigh's 2nd element)
//  return the highest/lowest channel in the tier
//
function FindChannelInTier(tier, channel_position) {
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

//
//  AssertTier tests whether the tier has been targeted to have any noise floor/channels/axes plotted
//  loop through the ChSignalHigh array (example: [1,36,-95,-120,""]), matching 1st element
//  returns the tier if it exists, null if not existing
//
function AssertTier(tier) {
	for (var i=0; i<ChSignalHigh.length; i++) {
		if (tier==ChSignalHigh[i][0]) {
			return ChSignalHigh[i][0]
		}
	}
	return null
}

//
//  FullChannelCount counts how many channels 20MHz wide channels are in a tier
//    tier_noise is the reduced noise floor array (reduced to a single tier's elements)
//  returns how many channels are offset by 4 or more (some countries allow 10MHz channels)
//
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

//
//  GetChannelWidth gets the width of a channel in the given tier
//    note: all channels in a tier are of equal width, but not every country has channels that are +4/-4 apart (20MHz wide)
//  finds either the next 20MHz channel, or the previous 20MHz channel (some channels in some schemes are 10MHz wide)
//  returns the width (difference in x coordinates between this channel & the next/previous 20MHz channel)
//
function GetChannelWidth(tier, channel) {
	if (GetTierForChannel((channel+4),ChSignalHigh) != null) {
		return GetChannelCenter((channel+4))-GetChannelCenter(channel)
	} else if (GetTierForChannel((channel-4),ChSignalHigh) != null) {
		return GetChannelCenter(channel)-GetChannelCenter((channel-4))
	}
}

//
//  GetTierWidth
//  totals the number of channels in the tier (ChSignalHigh array element 1)
//    note: 930 is hardcoded in InitTiers(); each tier has a minimum of 8 channels - also defined in InitTiers()
//  returns the width of pixels dedicated to plotting stations (there could be void space at the end of the tier)
//
function GetTierWidth(tier) {
	var channels=0;
	for (var i=0; i<ChSignalHigh.length; i++) {
		if (tier==ChSignalHigh[i][0]) { channels++; }
	}
	return (channels*(930/(channels < 8 ? 8 : channels)));
}

//
//  GetNextChannel finds the channel that follows the given channel in the target tier
//  loop through the ChSignalHigh array (example: [1,36,-95,-120,""]), matching tier -> 1st element
//  if the channel is missing (meaning just find the first channel in the tier), return the channel of the first matching tier element
//    note: if sort in wifi_survey.js did its job, the first one is the lowest channel in the tier
//  if the ChSignalHigh element also matches the channel (ChSignalHigh 2nd element):
//    if there is another element in the ChSignalHigh array, and it is in the same tier, return that next element's channel
//  returns either the initial channel in the tier, the channel following var channel, or null
//
function GetNextChannel(tier, channel) {
	for (var i=0; i<ChSignalHigh.length; i++) {
		if (tier == ChSignalHigh[i][0]) {
			if (channel==ChSignalHigh[i][1]) {
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

//
//  PlotNoiseFloor plots the noise floor across all the tiers - surprise!
//    noise is the array from wifi_survey.js example: [ [36,5180,-90], [40,5200,-92] ... ]
//  loop through the 3 tiers - though the middle tier might not contain any channels to plot
//  in each tier, pass the entry signal height of the noise floor from the first channel onto PlotNoisePath() which returns the waveform
//  generate a path element for the stroke (the line of the noise floor) fully opaque & append to the target tier
//  for the fill, continue plotting: V830 (vertical line down to 830), H0 (line back to 0)
//  append the path as the fill (it closes automatically with a fill) as 20% transparent
//
function PlotNoiseFloor(noise) {
	var initial_chan=0;
	
	for (var tier = 1; tier <= 3; tier++) {
		initial_chan=FindChannelInTier(tier,0);
		var nline=PlotNoisePath(0, GetNoiseInChannel(initial_chan), tier, ChSignalHigh);
		
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

//
//  PlotStations will plot any existing stations (belonging to these frequencies) across available tiers
//    stations is the array of known stations (example: [ ["DooDah", [11,"-"], 2462, -54] ...]
//  find the tier each station belongs to
//  find the width of a 20MHz channel in this tier (channel widths can vary in each tier)
//  if the ChSignalHigh array contains a lower signal for this channel, change element 4 (-120 in this example: [1,36,-95,-120,""]) as the new record high for this channel
//
function PlotStations(stations) {
	for (var i = 0; i<stations.length; i++) {
		var stchannel=GetChannelInfo(stations[i][1]);
		if (stchannel < 30) { continue; } //stations contains 2.4GHz & 5GHz data
		
		var ch_tier = GetTierForChannel(stchannel, ChSignalHigh);
		if (ch_tier == null) { continue }
		var container=document.getElementById("T"+ch_tier+"ChartG");
		var chanWidth = GetChannelWidth(ch_tier, stchannel)
		
		PlotStationPath(stations, i, chanWidth, ch_tier, container);
		
		if (stations[i][3] > ChSignalHigh[GetChannelRecordIndex(stchannel, ChSignalHigh)][3]) {
			ChSignalHigh[GetChannelRecordIndex(stchannel, ChSignalHigh)][3] = parseInt(stations[i][3]);
		}
	}
}	

//
//  GenChartYLabel puts the 'Signal level' label up the y axis
//  if tier 2 exists, label only tier 2; otherwise label tier1&3
//
function GenChartYLabel() {
	for (var tier=1; tier<=3; tier++) {
		var a_tier=document.getElementById("Y"+tier+"_label");
		if (((tier ==1 || tier ==3) && AssertTier(2) != null) || a_tier == null) { continue }
		var ylabel=GenerateTextElement(-115, 10, "rotate(-90) matrix(3 0 0 1 0 0)", "middle", "Signal Level (in dbm)", "16px", "");
		ylabel.setAttribute("dy", "-45px");
		a_tier.appendChild(ylabel);
	}
}

//
//  InitTiers will initialize an individual tier with ticks, labels + a scaled chart area
//    chart_size is unused; parentElement is the container for this tier ("chartarea"), tier is 1-3
//    tier_noise is the reduced noise floor array (reduced to a single tier's elements) example: [ [34,5180,-80], [36,5180,-70] ... ]
//  for x axis:
//  find how many channels are present in this tier - minimum channel width is 8, so 5 channels will have void space at end
//  each channel gets a group with a transform on it (so text can line up over the channel number)
//  the end of each channel also gets a group with a transform on it for a single tick mark
//  if the next channel is 10MHz wide (+2 != null), make a tick 1/4 of the way to the next channel
//  if the previous channel was 10MHz wide (meaning the next is a full 20MHz channel), make an intermediate spaced tick
//  else make a full sized tick
//  append a child element to the groups (one text, one line) subject to the translates created above
//  gXaxis stacks scaled tiers into 'chartarea'
//  for y axis:
//  setup a scaled matrix & generate group (also subject to translate/matrix xcaling); one group gets unsquished 0to-120 labels
//  NOTE: most chart elements are appended onto each tier's gYaxis - which has matrix scaling - 1/3 y scaled when appended
//
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
		
		if (GetChannelRecordIndex(tier_noise[i][0]+2, ChSignalHigh) != null) {
			gchannel.setAttribute("transform", "translate("+ (channel_width*(i*0.5)+(channel_width*0.25)) +",0)");
			gtick.setAttribute("transform", "translate("+ (channel_width*(i+1))*0.5 +",-10)");
			overlapping_channels++;
		} else if (GetChannelRecordIndex(tier_noise[i][0]-2, ChSignalHigh) != null) {
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

//
//  InitBand scans through the channels trying to figure out how to make tiers out the channels
//    chart_size is unused; parentElement is the element group container "chartarea";
//    available_channels is the full noise floor array for this band (example: [ [34,5180,-80], [36,5180,-70] ... ])
//  tries to make tier1 channels: 30-99; tier2 channels: 132-(at least 5 channels) - or skip; tier 3 channels: remainder
//
function InitBand(chart_size, parentElement, available_channels) {
	var tier_lowest_channel = 0;
	var tier_noise = null;
	var tier = 0;
	
	for (var i=0; i<available_channels.length; i++) {
		if (available_channels[i][0] > 30 && i == 0) {
			tier_lowest_channel=i;
		} else if (available_channels[i][0] > 99 && tier_noise == null) {
			tier_noise=available_channels.slice(tier_lowest_channel, i);
			InitChannelHighs(1, tier_noise, ChSignalHigh);
			InitTiers(chart_size, parentElement, ++tier, tier_noise);
			tier_lowest_channel=i;
		} else if (available_channels[i][0] >= 132 && tier == 1 && (available_channels.length-i) > 5) {
			tier_noise=available_channels.slice(tier_lowest_channel, i);
			InitChannelHighs(2, tier_noise, ChSignalHigh);
			InitTiers(chart_size, parentElement, ++tier, tier_noise);
			tier_lowest_channel=i;
		} else if (i+1 == available_channels.length) {
			tier_noise=available_channels.slice(tier_lowest_channel);
			InitChannelHighs(3, tier_noise, ChSignalHigh);
			InitTiers(chart_size, parentElement, 3, tier_noise);
		}
	}
	GenChartYLabel();
}

//
//  ClearChart deletes all child elements of "chartarea" (labels, transforms, noise floor, stations & tiers)
//  Also resets ChSignalHigh to empty
function ClearChart(parentElement) {
	while (parentElement.lastChild) {
		parentElement.removeChild(parentElement.lastChild);
	}
	ChSignalHigh.length=0;
}

//
//  bringNoiseForward takes the noise floor elements (the stroke & the fill) which were plotted first & are behind the stations
//  forward so they cover the station fill
//  
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

//
//  GenerateChannelSeparators creates a black void wedge polygon where there is a gap in channel numbers (>4 apart)
//
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

// plotBand encompases the entire plotting process
function plotBand(chart_size, noise, stations) {
	var svgChart = document.getElementById("chartarea");
	InitVars(y_unit, 45, 855, 0);
	ClearChart(svgChart);
	InitBand(chart_size, svgChart, noise);
	PlotNoiseFloor(noise);
	PlotStations(stations);
	
	bringNoiseForward();
	GenerateChannelSeparators();
	GenerateLabels(stations, ChSignalHigh);
	//thinking I won't generate a backer for 5GHz
}
