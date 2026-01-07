import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';
import { CategoryRailBlock } from '@/types/content';
import { Colors } from '@/constants/theme';
import { useDeviceDimensions } from '@/hooks/useDeviceDimensions';
import { useRouter } from 'expo-router';

interface VisualCategoryRailProps extends Omit<BaseContentBlockProps, 'onPress'> {
    block: CategoryRailBlock;
    onPress?: (link?: string, item?: any) => void;
}

export function VisualCategoryRail({ block, onPress }: VisualCategoryRailProps) {
    const router = useRouter();
    const { data = [], railConfig = {}, styles: blockStyles } = block;

    const size = railConfig.size ?? 70;
    const gap = railConfig.gap ?? 16;
    const showLabel = railConfig.showLabel ?? true;
    const shape = railConfig.shape ?? 'circle';

    let borderRadius = 0;
    if (shape === 'circle') borderRadius = size / 2;
    else if (shape === 'rounded') borderRadius = 12;
    // 'square' is 0

    const handlePress = (item: any) => {
        if (onPress) {
            if (item.link) {
                onPress(item.link, item);
            } else if (item.collectionId) {
                onPress(`/collections/${item.collectionId}`, item);
            }
        }
    };

    if (!data?.length) return null;

    return (
        <BaseContentBlock block={block}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[
                    styles.container,
                    {
                        gap,
                        paddingHorizontal: blockStyles?.container?.paddingHorizontal ?? 20
                    },
                    blockStyles?.container
                ]}
            >
                {data.map((item, index) => (
                    <TouchableOpacity
                        key={item.id || index}
                        style={[styles.item, blockStyles?.item]}
                        onPress={() => handlePress(item)}
                        activeOpacity={0.8}
                    >
                        <View
                            style={[
                                styles.imageContainer,
                                { width: size, height: size, borderRadius },
                                blockStyles?.imageContainer
                            ]}
                        >
                            <Image
                                source={{ uri: item.imageUrl }}
                                style={[
                                    styles.image,
                                    { borderRadius },
                                    blockStyles?.image
                                ]}
                                resizeMode="cover"
                            />
                        </View>
                        {showLabel && (
                            <Text
                                style={[styles.label, { width: size + 10 }, blockStyles?.text]}
                                numberOfLines={2}
                            >
                                {item.label}
                            </Text>
                        )}
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </BaseContentBlock>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 15,
        alignItems: 'flex-start',
    },
    item: {
        alignItems: 'center',
    },
    imageContainer: {
        backgroundColor: '#F2F2F2',
        marginBottom: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#EEEEEE',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    label: {
        fontSize: 12,
        color: '#333',
        textAlign: 'center',
        fontWeight: '500',
        lineHeight: 16,
    },
});
