import { Colors, Fonts } from '@/constants/theme';
import { useCartStore } from '@/store/cartStore';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
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
    const [dob, setDob] = useState(schoolCouponData?.dob || '');
    const [gender, setGender] = useState(schoolCouponData?.gender || '');
    const [showError, setShowError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [dobError, setDobError] = useState(false);
    const [dobNumericError, setDobNumericError] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        if (Platform.OS === 'android') {
            const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => {
                setKeyboardHeight(e.endCoordinates.height);
            });
            const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
                setKeyboardHeight(0);
            });

            return () => {
                showSubscription.remove();
                hideSubscription.remove();
            };
        }
    }, []);

    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 16 }, (_, i) => (currentYear - i).toString());

    useEffect(() => {
        if (visible) {
            if (schoolCouponData) {
                setChildName(schoolCouponData.childName || '');
                setParentName(schoolCouponData.parentName || '');
                setDob(schoolCouponData.dob || '');
                setGender(schoolCouponData.gender || '');
            } else {
                setChildName('');
                setParentName('');
                setDob('');
                setGender('');
            }
            setShowError(false);
            setErrorMessage('');
            setDobError(false);
            setDobNumericError(false);
        }
    }, [visible, schoolCouponData]);

    const handleSave = () => {
        if (!childName.trim() || !parentName.trim() || !dob.trim() || !gender) {
            setErrorMessage('All fields are mandatory for this coupon.');
            setShowError(true);
            return;
        }

        // Basic DOB format validation (MM/YYYY)
        const dobRegex = /^(0[1-9]|1[0-2])\/\d{4}$/;
        if (!dobRegex.test(dob.trim())) {
            setDobError(true);
            setErrorMessage('Please enter DOB in MM/YYYY format');
            setShowError(true);
            return;
        }

        const data = {
            childName: childName.trim(),
            parentName: parentName.trim(),
            dob: dob.trim(),
            gender: gender,
        };

        console.log('[SchoolCouponModal] Saving Student Details:', data);

        setSchoolCouponData(data);
        onClose();
        setShowError(false);
        setErrorMessage('');
        setDobError(false);
        setDobNumericError(false);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <View style={styles.overlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardAvoid}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
                    <View style={styles.container}>
                        <View style={styles.header}>
                            <View style={styles.headerTitleRow}>
                                <View style={styles.headerLeft}>
                                    <Ionicons name="school-outline" size={24} color={Colors.primary} />
                                    <Text style={styles.title}>Student Details</Text>
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
                            contentContainerStyle={[
                                styles.scrollContent,
                                Platform.OS === 'android' && { paddingBottom: keyboardHeight }
                            ]}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
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

                            <View style={[styles.row, { marginBottom: 0 }]}>
                                <View style={[styles.field, { flex: 1, marginRight: 10 }]}>
                                    <Text style={styles.label}>Child's DOB *</Text>
                                    <TouchableOpacity
                                        style={[styles.input, dobError && styles.inputError, styles.datePickerTrigger]}
                                        onPress={() => setShowDatePicker(true)}
                                    >
                                        <Text style={[styles.dateText, !dob && styles.placeholderText]}>
                                            {dob || 'MM/YYYY'}
                                        </Text>
                                        <Ionicons name="calendar-outline" size={18} color="#6B7280" />
                                    </TouchableOpacity>
                                    {dobError && <Text style={styles.inlineErrorText}>Mandatory field</Text>}
                                </View>

                                <View style={[styles.field, { flex: 1 }]}>
                                    <Text style={styles.label}>Gender *</Text>
                                    <View style={styles.genderRow}>
                                        <TouchableOpacity
                                            style={[
                                                styles.genderButton,
                                                gender === 'boy' && styles.genderButtonSelected
                                            ]}
                                            onPress={() => setGender('boy')}
                                        >
                                            {/* <Ionicons
                                                name="male"
                                                size={18}
                                                color={gender === 'boy' ? '#fff' : '#6B7280'}
                                            /> */}
                                            <Text style={[
                                                styles.genderText,
                                                gender === 'boy' && styles.genderTextSelected
                                            ]}>Boy</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[
                                                styles.genderButton,
                                                gender === 'girl' && styles.genderButtonSelected
                                            ]}
                                            onPress={() => setGender('girl')}
                                        >
                                            {/* <Ionicons
                                                name="female"
                                                size={18}
                                                color={gender === 'girl' ? '#fff' : '#6B7280'}
                                            /> */}
                                            <Text style={[
                                                styles.genderText,
                                                gender === 'girl' && styles.genderTextSelected
                                            ]}>Girl</Text>
                                        </TouchableOpacity>
                                    </View>
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

                {/* Month/Year Picker Modal */}
                <Modal
                    visible={showDatePicker}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setShowDatePicker(false)}
                >
                    <View style={styles.pickerOverlay}>
                        <View style={styles.pickerContainer}>
                            <View style={styles.pickerHeader}>
                                <Text style={styles.pickerTitle}>Select Month & Year</Text>
                                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                    <Text style={styles.doneText}>Done</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.pickerContent}>
                                <View style={styles.pickerColumn}>
                                    <Text style={styles.columnLabel}>Month</Text>
                                    <ScrollView
                                        style={styles.wheelScrollView}
                                        showsVerticalScrollIndicator={false}
                                        snapToInterval={40}
                                        decelerationRate="fast"
                                    >
                                        {months.map((m) => (
                                            <TouchableOpacity
                                                key={m}
                                                style={[styles.wheelItem, dob.startsWith(m) && styles.wheelItemSelected]}
                                                onPress={() => {
                                                    const year = dob.split('/')[1] || years[0];
                                                    setDob(`${m}/${year}`);
                                                    setDobError(false);
                                                }}
                                            >
                                                <Text style={[styles.wheelItemText, dob.startsWith(m) && styles.wheelItemTextSelected]}>
                                                    {m}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                        <View style={styles.wheelPadding} />
                                    </ScrollView>
                                </View>

                                <View style={styles.verticalDivider} />

                                <View style={styles.pickerColumn}>
                                    <Text style={styles.columnLabel}>Year</Text>
                                    <ScrollView
                                        style={styles.wheelScrollView}
                                        showsVerticalScrollIndicator={false}
                                        snapToInterval={40}
                                        decelerationRate="fast"
                                    >
                                        {years.map((y) => (
                                            <TouchableOpacity
                                                key={y}
                                                style={[styles.wheelItem, dob.endsWith(y) && styles.wheelItemSelected]}
                                                onPress={() => {
                                                    const month = dob.split('/')[0] || months[0];
                                                    setDob(`${month}/${y}`);
                                                    setDobError(false);
                                                }}
                                            >
                                                <Text style={[styles.wheelItemText, dob.endsWith(y) && styles.wheelItemTextSelected]}>
                                                    {y}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                        <View style={styles.wheelPadding} />
                                    </ScrollView>
                                </View>
                            </View>
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
        flex: 1,
        width: '100%',
        justifyContent: 'flex-end',
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
        paddingBottom: 8,
    },
    field: {
        marginBottom: 12,
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
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        paddingBottom: 12,
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
    genderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 48,
    },
    genderButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        marginHorizontal: 2,
    },
    genderButtonSelected: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    genderText: {
        fontSize: 13,
        fontFamily: Fonts.LexendMedium,
        color: '#6B7280',
        marginLeft: 4,
    },
    genderTextSelected: {
        color: '#fff',
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
    datePickerTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dateText: {
        fontSize: 14,
        fontFamily: Fonts.LexendRegular,
        color: '#1A1A1A',
    },
    placeholderText: {
        color: '#9CA3AF',
    },
    pickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    pickerContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    pickerTitle: {
        fontSize: 16,
        fontFamily: Fonts.LexendBold,
        color: '#1A1A1A',
    },
    doneText: {
        fontSize: 16,
        fontFamily: Fonts.LexendBold,
        color: Colors.primary,
    },
    pickerContent: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 20,
        height: 380,
    },
    pickerColumn: {
        flex: 1,
        alignItems: 'center',
    },
    columnLabel: {
        fontSize: 13,
        fontFamily: Fonts.LexendBold,
        color: '#111827',
        textAlign: 'center',
        marginBottom: 8,
    },
    wheelScrollView: {
        width: '100%',
    },
    wheelPadding: {
        height: 60,
    },
    wheelItem: {
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
    },
    wheelItemSelected: {
        backgroundColor: '#F3F4F6',
    },
    wheelItemText: {
        fontSize: 16,
        fontFamily: Fonts.LexendMedium,
        color: '#9CA3AF',
    },
    wheelItemTextSelected: {
        fontSize: 18,
        color: Colors.primary,
        fontFamily: Fonts.LexendBold,
    },
    verticalDivider: {
        width: 1,
        backgroundColor: '#F3F4F6',
        marginHorizontal: 10,
        height: '100%',
    },
});
