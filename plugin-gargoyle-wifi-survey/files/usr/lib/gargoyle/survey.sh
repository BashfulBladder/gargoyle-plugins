#!/bin/sh

#version 21 © 2013 BashfulBladder as part of plugin-gargoyle-wifi-survey for Gargoyle router firmware

newSurvey=/tmp/tmp_survey.txt
oldSurvey=/tmp/survey_data.txt
sta_dir=/tmp/stations
iw_out=/tmp/iw_out.txt

now=$(date "+%Y%m%d%H%M")
iwlps=`ps | grep iwlist | grep -v grep`
iwps=`ps | grep iwlist | grep -v grep`
wifs=`awk '{ gsub(/:/,""); printf (NR>2 ? $1" " : null)} END {printf "\n"}' /proc/net/wireless`
memb=1

ScanNscrap_iw() {
  echo "" > "$iw_out"
  for wiface in `iwconfig 2>/dev/null | grep 'IEEE' | awk '{print $1}'`
  do
    iw dev "$wiface" scan >> "$iw_out"
    # yes, floating point because awk was changing channels 3,7 & 11 to be off by 1 MHz
    iwlist "$wiface" chan | awk -v freq="$freq2" '/Channel/ {printf "chdata.push([%i,%.0f]);\n", $2, $4*1000}' >> /tmp/chfrq.txt
    iw dev "$wiface" survey dump | awk '/frequency/,/noise/ { i++; ORS=i%2?FS:RS; printf i%2 ? "frqdata.push(["$2 : ","$2"]);\n"}' >> /tmp/chfrq.txt
  done
  awk -v sdir="$sta_dir" '/^BSS/{x=++i;} x{print > sdir"/station_iw"x;}' "$iw_out"
  
  if [ -e "$sta_dir"/station_iw1 ] ; then
	for station in `ls $sta_dir`
	do
		Mode=""; Privacy=""; sRate=""; eRate=""; HTmode=""; MCSrates=""; streams=""; channeloffset=""; channelwidth="";
		WPA=""; Gcipher1=""; Pcipher1=""; AuthSuites1="";    WPA2=""; Gcipher2=""; Pcipher2=""; AuthSuites2="";
  
		shvars=`awk '/^BSS/ {print "MAC="$2} /\tfreq:/ {split($2,c,""); print "Freq="c[1]"."c[2]c[3]c[4]} /\tsignal:/ {printf "Level=%i\n", $2} /\tcapability:/ {for(i=2;i<=NF;++i) if($i=="IBSS") print "Mode=\"Ad Hoc\""; else if ($i=="ESS") print "Mode=Station"; else if ($i=="Privacy") print "Privacy=on"} /\tSSID:/ {printf "SSID=\""; for(i=2;i<=NF;++i) printf("%s%s", $i, i==NF?"\"\n":" ") } /\tSupported rates:/ {printf "sRate=%i\n", $NF} /\tDS Parameter set:/ {print "Channel="$NF} /\tExtended supported rates:/ {printf "eRate=%i\n", $NF} /\tHT capabilities:/,/DSSS/ {for(i=2;i<=NF;++i) if ($i == "HT40") print "HTmode="$i } /rate indexes supported:/ {print "rates="$NF} /spatial streams:/ {print "streams="$NF} /secondary channel offset:/ {print "channeloffset="$NF} /channel width:/ {print "channelwidth="$5} /\tWPA:/,/Authentication suites:/ {for(i=2;i<=NF;++i) if ($i == "Version:") print "WPA=WPA"$i+1 ; else if ($i == "Group") print "Gcipher1="$(i+2); else if ($i == "Pairwise") {printf "Pcipher1="; for(j=4;j<=NF;j++) printf("%s%s", $j, j==NF?"\n":",")} else if ($i == "Authentication") {print "AuthSuites1="$NF}} /\tRSN:/,/Capabilities:/ {for(i=2;i<=NF;++i) if ($i == "Version:") print "WPA2=WPA2v"$i+1 ; else if ($i == "Group") print "Gcipher2="$(i+2); else if ($i == "Pairwise") {printf "Pcipher2="; for(j=4;j<=NF;j++) printf("%s%s", $j, j==NF?"\n":",")} else if ($i == "Authentication") {print "AuthSuites2="$NF}}' "$sta_dir"/$station`
		
		eval $shvars
  
		Nspeed=`awk '/HT capabilities:/ {txt=1;next} /HT operation:/{txt=0} txt{print}' "$sta_dir"/$station | awk -F '[ -]' '/rate indexes supported:/ {printf "%i",  ($(NF)+1) * 18.75}' `
		noise=`awk -v frq="$Freq" 'BEGIN{FS="[],[]"} {f=frq*10*10*10} /frqdata/ {if (f == $2) print $3}' /tmp/chfrq.txt`
		if [ -z "$noise" ] ; then
			noise=-120
		fi
		if [ -z "$Privacy" ] ; then
			Privacy=off
		fi
		#take care of some weird -100/-87 inversions; don't know how correct this is, but as signal fluctuates, consider this part&parcel
		if [ $noise -gt $Level ] ; then
			Level=$(expr $noise - $(expr $Level - $noise))
		fi
		if [ ! -z "$channeloffset" ] ; then
			if [ ! -z $(echo "$channelwidth" | grep '40') ] || [ ! -z $(echo "$channelwidth" | grep '^any') ] ; then
				if [ "$channeloffset" == "above" ] || [ "$channeloffset" == "+" ] ; then
					Channel="$Channel+"
				fi
				if [ "$channeloffset" == "below" ] || [ "$channeloffset" == "-" ] ; then
					Channel="$Channel-"
				fi
    		fi
		fi
		
		printf "sdata.push([\"%s\",\"%s\",\"%s\",\"%.3f\",\"%s\",\"%i\",\"%s\",\"%s\",[" \
  			"$MAC" "$now" "$Channel" "$Freq" "$noise" "$Level" "$Privacy" "$SSID" >> "$newSurvey"
  			
  		if [ ! -z "$sRate" ] && [ "$sRate" -gt 0 ] ; then
    		printf "%i" "$sRate" >> "$newSurvey"
  		fi
  		if [ ! -z "$eRate" ] && [ "$eRate" -gt 0 ] ; then
    		printf ",%i" "$eRate" >> "$newSurvey"
  		fi
  		if [ ! -z "$HTmode" ] ; then #802.11n HT40
    		printf ",150" >> "$newSurvey"
  		fi
  		if [ ! -z "$Nspeed" ] && [ "$Nspeed" -gt 0 ] ; then #802.11n MIMO
  			if [ $Nspeed -gt 600 ] ; then
  				Nspeed=$(expr $streams \* 150)
  			fi
    		printf ",%i" "$Nspeed" >> "$newSurvey"
  		fi
  		printf "],\"%s\"" "$Mode" >> "$newSurvey"
  		#Group ciphers are omitted (seems to equal to pairwise or a 1 of the 2 in pairwise
  		if [ ! -z "$WPA" ] ; then
  			printf ",[\"%s\",\"%s\",\"%s\"]" "$WPA" "$Pcipher1" "$AuthSuites1" >> "$newSurvey"
  		fi
  		if [ ! -z "$WPA2" ] ; then
  			printf ",[\"%s\",\"%s\",\"%s\"]" "$WPA2" "$Pcipher2" "$AuthSuites2" >> "$newSurvey"
  		fi
  		printf "]);\n" >> "$newSurvey"
  	done
  fi
}

ScanNscrap_iwlist() {
  iwlist scan 2>/dev/null | sed '/          Cell 01/,$!d' | awk -v sdir="$sta_dir" '/          Cell/{++i;}{print > sdir"/station_iwl"i;}'
  
  if [ -e "$sta_dir"/station_iwl1 ] ; then
  	for station in `ls $sta_dir`
  	do
		Rates0=""; Rates1=""; Rates2=""; Rates3=""; WPA=""; WPA2v=""; Cipher=""; PWCipher=""; Suites=""; channelwidth=""; channeloffset=""; 
  
		shvars=`awk -F '[ :=]+' '/Address/{print"MAC="substr($0,30) } /Channel:/ {print "Chan="$3} /Freq/{print "Freq="$3} /Quality/ {printf "Qual="$3 "\nLevel="$6"\n"} /Encr/{print "Encr="$4} /ESS/{print "ESS="substr($0,27)} /Rates:/{sub(/\n/, " "); printf "Rates%i=%i\n", i++, $(NF-1)} /Rates:/{ getline; sub(/\n/, " "); printf "Rates%i=%i\n", i++, $(NF-1)} /Mode:/{print "Mode="$3} /IEEE 802.11i/ {split($4,a,"/"); print "WPA2v="a[2]"v"$6} /WPA Version 1/ {print "WPA=WPA1"} /Group Cipher/{print "Cipher="$4} /Pairwise Ciphers/{print "PWCipher="$5} /Suites/{print "Suites="$5}' "$sta_dir"/$station`
		
		eval $shvars
		
		printf "sdata.push([\"%s\",\"%s\",\"%i\",\"%.3f\",\"%s\",\"%i\",\"%s\",\"%s\",[" \
  			"$MAC" "$now" "$Chan" "$Freq" "$Qual" "$Level" "$Encr" "$ESS" >> "$newSurvey"
  		if [ ! -z "$Rates0" ] && [ "$Rates0" -gt 0 ] ; then
    		printf "%i" "$Rates0" >> "$newSurvey"
  		fi
  		if [ ! -z "$Rates1" ] && [ "$Rates1" -gt 0 ] ; then
    		printf ",%i" "$Rates1" >> "$newSurvey"
  		fi
		if [ ! -z "$Rates2" ] && [ "$Rates2" -gt 0 ] ; then
			printf ",%i" "$Rates2" >> "$newSurvey"
		fi
		if [ ! -z "$Rates3" ] && [ "$Rates3" -gt 0 ] ; then
			printf ",%i" "$Rates3" >> "$newSurvey"
		fi
		printf "],\"%s\"" "$Mode" >> "$newSurvey"
		# see Group cipher note above
		if [ ! -z "$WPA" ] ; then
			printf ",[\"%s\",\"%s\",\"%s\"]" "$WPA" "$PWCipher" "$Suites" >> "$newSurvey"
		fi
		if [ ! -z "$WPA2v" ] ; then
			printf ",[\"%s\",\"%s\",\"%s\"]" "$WPA2v" "$PWCipher" "$Suites" >> "$newSurvey"
		fi
		printf "]);\n" >> "$newSurvey"
  	
  	done
  fi
}

printANDexit() {
	if [ -e "$oldSurvey" ] ; then
		cat "$oldSurvey"
	fi
	if [ -e /tmp/chfrq.txt ] ; then
		cat /tmp/chfrq.txt
	fi
	rm -rf "$sta_dir"
	if [ -e "$iw_out" ] ; then
		rm "$iw_out"
	fi
	exit
}

if [ ! -z "$iwlps" ] || [ ! -z "$iwps" ] ; then
	printANDexit
fi

if [ -z "$wifs" ] ; then
	printANDexit
fi

if [ ! -d "$sta_dir" ] ; then
	mkdir "$sta_dir"
fi

echo "var sdata = new Array();" > "$newSurvey"
echo "var chdata = new Array();" > /tmp/chfrq.txt
echo "var frqdata = new Array();" >> /tmp/chfrq.txt

if [ -e /usr/sbin/iw ] ; then
  ScanNscrap_iw
else
  ScanNscrap_iwlist
fi

while true; do
	if [ ! -e "$oldSurvey" ] ; then
		break
	fi
	aline=$(awk -v rec=$memb 'NR==rec {print $0}' "$oldSurvey")
	if [ -z "$aline" ] ; then
		break
	fi 
	
	amac=`echo "$aline" | awk -F '\"' '{print $2}'`
	ats=`echo "$aline" | awk -F '\"' '{print $4}'`
	if [ ! -z "$amac" ] ; then
		curr_mac=`grep -i -e "$amac" "$newSurvey"`
		if [ -z "$curr_mac" ] ; then
			time_diff=$(expr $(date -d $now +%s) - $(date -d $ats +%s))
			if [ $(expr $time_diff / 86400) -lt 45 ]; then
				echo $aline >> "$newSurvey"
			fi
		fi
	fi
	let memb++
done

rm -rf "$iw_sta_dir"
rm "$iw_out"

mv -f "$newSurvey" "$oldSurvey"
printANDexit
