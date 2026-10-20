import { StyleSheet, Text, View } from 'react-native';
import type { HelpRequest } from './location';
import type { OfferStatus } from '../offers/types';
const green = { background: '#E4F5E9', text: '#176232', border: '#A2D7B2' };
const yellow = { background: '#FFF3C4', text: '#775400', border: '#E3C864' };
const red = { background: '#FDE7E7', text: '#A32323', border: '#EAA5A5' };
const statuses = {
 open:{label:'Open',...green},accepted:{label:'Accepted',...yellow},completed:{label:'Completed',...green},expired:{label:'Expired',...yellow},cancelled:{label:'Cancelled',...red},
 pending:{label:'Pending',...yellow},withdrawn:{label:'Withdrawn',...red},declined:{label:'Declined',...red},
};
export function StatusBadge({ status }: { status: HelpRequest['status'] | OfferStatus }) {
 const appearance=statuses[status];
 return <View style={[styles.badge,{backgroundColor:appearance.background,borderColor:appearance.border}]}><Text accessibilityLabel={`Status: ${appearance.label}`} style={[styles.label,{color:appearance.text}]}>{appearance.label}</Text></View>;
}
const styles=StyleSheet.create({badge:{alignSelf:'flex-start',borderRadius:20,borderWidth:1,paddingHorizontal:12,paddingVertical:6},label:{fontSize:14,lineHeight:20,fontWeight:'700'}});
