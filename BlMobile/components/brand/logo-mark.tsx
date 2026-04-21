import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

interface Props {
    size?: number;
    fill?: boolean;
}

export function LogoMark({ size, fill = false }: Props) {
    const source = require('@/assets/images/logo.jpg');
    const resolved = Image.resolveAssetSource(source);
    const fallback = size && size > 0 ? size : 120;
    const naturalWidth = resolved?.width ?? fallback;
    const naturalHeight = resolved?.height ?? fallback;
    const scale = size && size > 0 ? Math.min(1, size / Math.max(naturalWidth, naturalHeight)) : 1;
    const width = Math.round(naturalWidth * scale);
    const height = Math.round(naturalHeight * scale);

    const radius = Math.round(Math.min(width, height) * 0.12);

    if (fill) {
        return (
            <View style={styles.fillFrame}>
                <Image source={source} style={styles.fillImage} resizeMode="contain" />
            </View>
        );
    }

    return (
        <View style={[styles.frame, { borderRadius: radius }]}>
            <Image source={source} style={[styles.image, { width, height, borderRadius: radius }]} resizeMode="contain" />
        </View>
    );
}

const styles = StyleSheet.create({
    fillFrame: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
    },
    fillImage: {
        width: '100%',
        height: '100%',
    },
    frame: {
        overflow: 'hidden',
        alignSelf: 'center',
        backgroundColor: '#ffffff',
    },
    image: {
        alignSelf: 'center',
    },
});
