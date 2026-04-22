import { Colors, Fonts } from '@/constants/theme';
import { useCartStore } from '@/store/cartStore';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface SchoolCouponModalProps {
    visible: boolean;
    onClose: () => void;
}

export function SchoolCouponModal({ visible, onClose }: SchoolCouponModalProps) {
    const schoolCouponData = useCartStore((state) => state.schoolCouponData);
    const setSchoolCouponData = useCartStore((state) => state.setSchoolCouponData);

    const [childName, setChildName] = useState(schoolCouponData?.childName || '');
    const [parentName, setParentName] = useState(schoolCouponData?.parentName || '');
    const [age, setAge] = useState(schoolCouponData?.age || '');
    const [className, setClassName] = useState(schoolCouponData?.class || '');
    const [showError, setShowError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [ageError, setAgeError] = useState(false);

    useEffect(() => {
        if (visible) {
            if (schoolCouponData) {
                setChildName(schoolCouponData.childName || '');
                setParentName(schoolCouponData.parentName || '');
                setAge(schoolCouponData.age || '');
                setClassName(schoolCouponData.class || '');
            } else {
                setChildName('');
                setParentName('');
                setAge('');
                setClassName('');
            }
            setShowError(false);
            setErrorMessage('');
            setAgeError(false);
        }
    }, [visible, schoolCouponData]);

    const handleSave = () => {
        if (!childName.trim() || !parentName.trim() || !age.trim() || !className.trim()) {
            setErrorMessage('All fields are mandatory for this coupon.');
            setShowError(true);
            return;
        }

        setSchoolCouponData({
            childName: childName.trim(),
            parentName: parentName.trim(),
            age: age.trim(),
            class: className.trim(),
        });
        onClose();
        setShowError(false);
        setErrorMessage('');
        setAgeError(false);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardAvoid}
                >
                    <View style={styles.container}>
                        <View style={styles.header}>
                            <View style={styles.headerTitleRow}>
                                <View style={styles.headerLeft}>
                                    <Ionicons name="school-outline" size={24} color={Colors.primary} />
                                    <Text style={styles.title}>School Details</Text>
                                </View>
                                <TouchableOpacity onPress={onClose} hitSlop={12}>
                                    <Ionicons name="close" size={24} color="#1A1A1A" />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.subtitle}>
                                Please provide child details to avail this coupon.
                            </Text>
                        </View>

                        <ScrollView
                            style={styles.scroll}
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={styles.field}>
                                <Text style={styles.label}>Child Name *</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter child's full name"
                                    value={childName}
                                    onChangeText={setChildName}
                                    autoCapitalize="words"
                                />
                            </View>

                            <View style={styles.field}>
                                <Text style={styles.label}>Parent Name *</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter parent's name"
                                    value={parentName}
                                    onChangeText={setParentName}
                                    autoCapitalize="words"
                                />
                            </View>

                            <View style={styles.row}>
                                <View style={[styles.field, { flex: 1, marginRight: 10 }]}>
                                    <Text style={styles.label}>Age *</Text>
                                    <TextInput
                                        style={[styles.input, ageError && styles.inputError]}
                                        placeholder="e.g. 5"
                                        value={age}
                                        onChangeText={(t) => {
                                            if (/[^0-9]/.test(t)) {
                                                setAgeError(true);
                                            } else {
                                                setAgeError(false);
                                            }
                                            setAge(t.replace(/[^0-9]/g, ''));
                                        }}
                                        keyboardType="numeric"
                                    />
                                    {ageError && <Text style={styles.inlineErrorText}>Only numbers allowed</Text>}
                                </View>

                                <View style={[styles.field, { flex: 1 }]}>
                                    <Text style={styles.label}>Class *</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="e.g. KG-1"
                                        value={className}
                                        onChangeText={setClassName}
                                        autoCapitalize="characters"
                                    />
                                </View>
                            </View>
                        </ScrollView>

                        <View style={styles.footer}>
                            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                                <Text style={styles.saveButtonText}>Save Details</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>

                {/* Custom Error Modal */}
                <Modal
                    visible={showError}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowError(false)}
                >
                    <View style={styles.errorOverlay}>
                        <View style={styles.errorContainer}>
                            <View style={styles.errorIconContainer}>
                                <Ionicons name="alert-circle" size={32} color="#EF4444" />
                            </View>
                            <Text style={styles.errorTitle}>Missing Details</Text>
                            <Text style={styles.errorMessage}>{errorMessage}</Text>
                            <TouchableOpacity 
                                style={styles.errorButton} 
                                onPress={() => setShowError(false)}
                            >
                                <Text style={styles.errorButtonText}>Got it</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    keyboardAvoid: {
        width: '100%',
    },
    container: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 24,
    },
    header: {
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        fontSize: Fonts.MediumFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#1A1A1A',
        marginLeft: 10,
    },
    subtitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#666',
        lineHeight: 20,
    },
    scroll: {
        paddingHorizontal: 16,
    },
    scrollContent: {
        paddingBottom: 0,
    },
    field: {
        marginBottom: 16,
    },
    label: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        marginBottom: 6,
        marginLeft: 4,
    },
    input: {
        height: 48,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendRegular,
        backgroundColor: '#F9FAFB',
    },
    row: {
        flexDirection: 'row',
    },
    footer: {
        paddingHorizontal: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        paddingBottom: 24,
    },
    saveButton: {
        backgroundColor: Colors.primary,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    saveButtonText: {
        fontSize: Fonts.MediumFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#fff',
    },
    errorOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    errorContainer: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 320,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    errorIconContainer: {
        marginBottom: 16,
    },
    errorTitle: {
        fontSize: 18,
        fontFamily: Fonts.LexendBold,
        color: '#111827',
        marginBottom: 8,
    },
    errorMessage: {
        fontSize: 14,
        fontFamily: Fonts.LexendRegular,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    errorButton: {
        backgroundColor: '#111827',
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
    },
    errorButtonText: {
        color: '#fff',
        fontSize: 15,
        fontFamily: Fonts.LexendMedium,
    },
    inputError: {
        borderColor: '#EF4444',
        backgroundColor: '#FEF2F2',
    },
    inlineErrorText: {
        color: '#EF4444',
        fontSize: 11,
        fontFamily: Fonts.LexendMedium,
        marginTop: 4,
        marginLeft: 4,
    },
});
