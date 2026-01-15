import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';
import { FeatureStripBlock } from '@/types/content';
import { Colors, Fonts } from '@/constants/theme';
import { processFontStyle } from '@/utils/fontUtils';

interface FeatureStripProps extends BaseContentBlockProps {
    block: FeatureStripBlock;
}

export function FeatureStrip({ block }: FeatureStripProps) {
    const { data = [], featureStripConfig = {}, styles: blockStyles } = block;
    const layout = featureStripConfig.layout ?? 'row';

    if (!data.length) return null;

    const Item = ({ item, index }: { item: any; index: number }) => (
        <View key={index} style={[styles.item, blockStyles?.item]}>
            {item.iconUrl && (
                <Image
                    source={{ uri: item.iconUrl }}
                    style={[styles.icon, blockStyles?.icon]}
                    resizeMode="contain"
                />
            )}
            <View style={styles.textContainer}>
                <Text style={[styles.label, processFontStyle(blockStyles?.text)]}>{item.label}</Text>
                {item.subLabel && (
                    <Text style={[styles.subLabel, processFontStyle(blockStyles?.subText)]}>{item.subLabel}</Text>
                )}
            </View>
        </View>
    );

    return (
        <BaseContentBlock block={block}>
            {layout === 'scroll' ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[
                        styles.container,
                        { gap: 24, paddingHorizontal: 20 },
                        blockStyles?.container
                    ]}
                >
                    {data.map((item, index) => <Item item={item} index={index} key={index} />)}
                </ScrollView>
            ) : (
                <View style={[styles.container, styles.rowContainer, blockStyles?.container]}>
                    {data.map((item, index) => <Item item={item} index={index} key={index} />)}
                </View>
            )}
        </BaseContentBlock>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 12,
        backgroundColor: '#F9F9F9',
    },
    rowContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        flexWrap: 'wrap',
        paddingHorizontal: 10,
        gap: 12,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FFF',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 50,
        borderWidth: 1,
        borderColor: '#EFEFEF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    icon: {
        width: 20,
        height: 20,
    },
    textContainer: {
        justifyContent: 'center',
    },
    label: {
        fontSize: 12,
        fontFamily: Fonts.SemiBold,
        color: '#333',
    },
    subLabel: {
        fontSize: 10,
        color: '#777',
    },
});
