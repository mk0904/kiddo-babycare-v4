import { Colors, Fonts } from '@/constants/theme';
import { ReferralFAQ } from '@/types/appConfig';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface FaqSectionProps {
    faqs: ReferralFAQ[];
    title?: string;
    initialExpandedIndex?: number | null;
}

export function FaqSection({
    faqs,
    title = 'FAQs',
    initialExpandedIndex = 0,
}: FaqSectionProps) {
    const [expandedFaq, setExpandedFaq] = useState<number | null>(initialExpandedIndex);

    if (!faqs.length) return null;

    return (
        <View style={styles.faqSection}>
            <Text style={styles.faqTitle}>{title}</Text>
            {faqs.map((faq, index) => (
                <View key={index} style={styles.faqItem}>
                    <TouchableOpacity
                        style={styles.faqHeader}
                        onPress={() => setExpandedFaq(expandedFaq === index ? null : index)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.faqQuestion}>{faq.question}</Text>
                        <Ionicons
                            name={expandedFaq === index ? 'remove-circle-outline' : 'add-circle-outline'}
                            size={24}
                            color={Colors.textSecondary}
                        />
                    </TouchableOpacity>
                    {expandedFaq === index && (
                        <Text style={styles.faqAnswer}>{faq.answer}</Text>
                    )}
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    faqSection: {
        marginBottom: 10,
        paddingHorizontal: 8,
    },
    faqTitle: {
        fontSize: 24,
        fontFamily: 'Fredoka_600SemiBold',
        color: '#181D27',
        marginBottom: 14,
    },
    faqItem: {
        marginBottom: 0,
    },
    faqHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    faqQuestion: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: '#181D27',
        flex: 1,
        marginRight: 10,
    },
    faqAnswer: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.Regular,
        color: '#535862',
        lineHeight: 20,
        paddingBottom: 15,
        paddingRight: 50,
    },
});
