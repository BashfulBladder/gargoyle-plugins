#!/bin/sh

newSurvey=/tmp/tmp_survey.txt
oldSurvey=/tmp/survey_data.txt
sta_dir=/tmp/stations
iw_out=/tmp/iw_out.txt
iw_sta_dir=/tmp/iw_stations

now=$(date "+%Y%m%d%H%M")
iwps=`ps | grep iwlist | grep -v grep`
memb=1

if [ ! -z "$iwps" ] ; then
	exit
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

if [ -e /usr/sbin/iw ] ; then
  for wiface in `iwconfig 2>/dev/null | grep 'IEEE' | awk '{print $1}'`
  do
    iw dev "$wiface" scan >> "$iw_out"
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
    Nspeed=`awk '/HT capabilities:/ {txt=1;next} /HT operation:/{txt=0} txt{print}' $target | awk -F '[ -]' '/rate indexes supported:/ {print ($(NF)+1) * 18.75}' `
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
	exit
fi

while true; do
	if [ ! -e "$oldSurvey" ] ; then
		break #ah, our first time - its special
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
			if [ $(expr $now - $ats) -lt 1850000 ] ; then
				echo $aline >> "$newSurvey"
			fi
		fi
	fi
	let memb++
done
iwps=`ps | grep iwlist | grep -v grep`
if [ ! -z "$iwps" ] ; then   #minimize impact of repeated webpage loadings
	exit
fi
rm -rf "$iw_sta_dir"
rm "$iw_out"

mv -f "$newSurvey" "$oldSurvey"
cat "$oldSurvey"
