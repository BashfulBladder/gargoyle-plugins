#!/bin/sh

newSurvey=/tmp/tmp_survey.txt
oldSurvey=/tmp/survey_data.txt
sta_dir=/tmp/stations
iw_out=/tmp/iw_out.txt
iw_sta_dir=/tmp/iw_stations

now=$(date "+%Y%m%d%H%M")
iwps=`ps | grep iwlist | grep -v grep`
wifs=`awk '{ gsub(/:/,""); printf (NR>2 ? $1" " : null)} END {printf "\n"}' /proc/net/wireless`
memb=1

printANDexit() {
	cat "$oldSurvey"
	cat /tmp/chfrq.txt
	exit
}

if [ ! -z "$iwps" ] ; then
	printANDexit
fi

if [ -z "$wifs" ] ; then
	printANDexit
fi

if [ ! -d "$sta_dir" ] ; then
	mkdir "$sta_dir"
fi
if [ ! -d "$iw_sta_dir" ] ; then
	mkdir "$iw_sta_dir"
fi
cd "$sta_dir"
# probably should switch to: awk '/          Cell/{++i;}{print > "station"i;}'
iwlist scan 2>/dev/null | sed '/          Cell 01/,$!d' | awk '/          Cell/{x="station"++i;}{print > x;}'

echo "var sdata = new Array();" > "$newSurvey"
echo "var chdata = new Array();" > /tmp/chfrq.txt
echo "var frqdata = new Array();" >> /tmp/chfrq.txt

if [ -e /usr/sbin/iw ] ; then
  for wiface in `iwconfig 2>/dev/null | grep 'IEEE' | awk '{print $1}'`
  do
    iw dev "$wiface" scan >> "$iw_out"
    # yes, floating point because awk was changing channels 3,7 & 11 to be off by 1 MHz
    iwlist "$wiface" chan | awk -v freq="$freq2" '/Channel/ {printf "chdata.push([%i,%.0f]);\n", $2, $4*1000}' >> /tmp/chfrq.txt
    iw dev "$wiface" survey dump | awk '/frequency/,/noise/ { i++; ORS=i%2?FS:RS; printf i%2 ? "frqdata.push(["$2 : ","$2"]);\n"}' >> /tmp/chfrq.txt
  done
  awk '/^BSS/{x=++i;} x{print > "/tmp/iw_stations/station"x;}' "$iw_out"
fi

for station in `ls $sta_dir`
do
  Rates0=""; Rates1=""; Rates2=""; Rates3=""; WPA=""; WPA2v=""; Cipher=""; PWCipher="";
  
  shvars=`awk -F '[ :=]+' '/Address/{print"MAC="substr($0,30) } /Channel:/ {print "Chan="$3} /Freq/{print "Freq="$3} /Quality/ {printf "Qual="$3 "\nLevel="$6"\n"} /Encr/{print "Encr="$4} /ESS/{print "ESS="substr($0,27)} /Rates:/{sub(/\n/, " "); printf "Rates%i=%i\n", i++, $(NF-1)} /Rates:/{ getline; sub(/\n/, " "); printf "Rates%i=%i\n", i++, $(NF-1)} /Mode:/{print "Mode="$3} /IEEE 802.11i/ {split($4,a,"/"); print "WPA2v="a[2]"v"$6} /WPA Version 1/ {print "WPA=WPA1"} /Group Cipher/{print "Cipher="$4} /Pairwise Ciphers/{print "PWCipher="$5} /Suites/{print "Suites="$5}' "$sta_dir"/$station`
  
  eval $shvars

  if [ -e "$iw_sta_dir"/station1 ] ; then
  	target=`grep -i -e $MAC -r $iw_sta_dir | awk -F ':' '{print \$1}'`
    HTmode=`grep -m 1 -e 'HT40' $target`
    Nspeed=`awk '/HT capabilities:/ {txt=1;next} /HT operation:/{txt=0} txt{print}' $target | awk -F '[ -]' '/rate indexes supported:/ {printf "%i",  ($(NF)+1) * 18.75}' `
    streams=`awk '/HT capabilities:/ {txt=1;next} /HT operation:/{txt=0} txt{print}' $target | awk -F ':' '/Max spatial streams/ {printf "%i", $2}' `
    if [ -z "$streams" ] ; then
    	streams=1
    fi
    # more awk floating point joy;
    # iwlist quality is expressed 22/70, whereas if iw is present, Qual is just the noise floor (here's hoping)
    noise=`awk -v frq="$Freq" 'BEGIN{FS="[],[]"} {f=frq*10*10*10} /frqdata/ {if (f == $2) print $3}' /tmp/chfrq.txt`
    if [ ! -z "$noise" ] ; then
    	Qual=$noise
    fi
    
    #take care of some weird -100/-87 inversions; don't know how correct this is, but as signal fluctuates, consider this part&parcel
    if [ $noise -gt $Level ] ; then
    	Level=$(expr $noise - $(expr $Level - $noise))
    fi
  fi
	
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
  if [ ! -z "$WPA" ] ; then
  	printf ",[\"%s\",\"%s\",\"%s\"]" "$WPA" "$Cipher" "$Suites" >> "$newSurvey"
  fi
  if [ ! -z "$WPA2v" ] ; then
  	printf ",[\"%s\",\"%s\",\"%s\"]" "$WPA2v" "$Cipher" "$Suites" >> "$newSurvey"
  fi
  printf "]);\n" >> "$newSurvey"
  
done

rm -rf "$sta_dir"

iwps=`ps | grep iwlist | grep -v grep`
if [ ! -z "$iwps" ] ; then   #minimize impact of repeated webpage loadings
	printANDexit
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
		curr_mac=`grep -e "$amac" "$newSurvey"`
		if [ -z "$curr_mac" ] ; then
			time_diff=$(expr $now - $ats)
			if [ $time_diff -gt 1400000 ] ; then
				time_diff=$(expr $time_diff - 1400000)
			fi
			if [ $time_diff -gt 700000 ] ; then
				time_diff=$(expr $time_diff - 700000)
			fi
			if [ $time_diff -lt 450000 ] ; then
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
