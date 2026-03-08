import { Image } from 'expo-image';
import React from 'react';
import { View } from 'react-native';

const SIZE = 170;

export function OrderSuccessIcon({ size = SIZE }: { size?: number }) {
    return (
        <View style={{ width: size, height: size }}>
            <Image
                source={require('@/assets/icons/order-success.svg')}
                style={{ width: size, height: size }}
                contentFit="contain"
            />
        </View>
    );
}
