import BaseModal from '@/components/ui/BaseModal';
import { Button } from '@/components/ui/Button';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { customerService } from '@/services/customerService';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const YEARS = Array.from({ length: 13 }, (_, i) => new Date().getFullYear() - i);

interface KiddoData {
  name: string;
  month: string;
  year: string;
  gender: 'boy' | 'girl' | 'prefer-not-to-say' | null;
}

export default function KiddoDetailsScreen() {
  const router = useRouter();
  const { user, login } = useAuth();
  const [kiddos, setKiddos] = useState<KiddoData[]>([
    { name: '', month: '', year: '', gender: null }
  ]);
  const [currentKiddoIndex, setCurrentKiddoIndex] = useState(0);
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [showYearModal, setShowYearModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentKiddo = kiddos[currentKiddoIndex];

  const updateCurrentKiddo = (updates: Partial<KiddoData>) => {
    const updatedKiddos = [...kiddos];
    updatedKiddos[currentKiddoIndex] = { ...updatedKiddos[currentKiddoIndex], ...updates };
    setKiddos(updatedKiddos);
  };

  const handleAddKiddo = () => {
    setKiddos([...kiddos, { name: '', month: '', year: '', gender: null }]);
    setCurrentKiddoIndex(kiddos.length);
  };

  const isFormValid = () => {
    // Check if at least one kiddo has required fields (month, year, gender)
    return kiddos.some(kiddo => 
      kiddo.month && kiddo.year && kiddo.gender !== null
    );
  };

  const calculateAgeInMonths = (month: string, year: string): number => {
    if (!month || !year) return 0;
    
    const monthIndex = MONTHS.indexOf(month);
    if (monthIndex === -1) return 0;
    
    const birthDate = new Date(parseInt(year), monthIndex, 1);
    const today = new Date();
    const yearsDiff = today.getFullYear() - birthDate.getFullYear();
    const monthsDiff = today.getMonth() - birthDate.getMonth();
    
    return yearsDiff * 12 + monthsDiff;
  };

  const handleContinue = async () => {
    if (!isFormValid()) {
      return; // Don't proceed if form is invalid
    }

    if (!user?.customerAccessToken || !user?.id) {
      Alert.alert('Error', 'Please login first');
      return;
    }

    setSaving(true);

    try {
      // Get the first kiddo with valid data
      const firstKiddo = kiddos.find(k => k.month && k.year && k.gender !== null);
      
      if (firstKiddo) {
        const ageMonths = calculateAgeInMonths(firstKiddo.month, firstKiddo.year);
        
        // Update customer metafields
        const result = await customerService.updateCustomerWithMetafields(
          user.customerAccessToken,
          {}, // No name update needed here
          {
            baby_name: firstKiddo.name || '',
            age: ageMonths.toString(),
            gender: firstKiddo.gender || '',
          },
          user.id
        );

        if (!result.success) {
          throw new Error(result.message || 'Failed to save kiddo details');
        }
      }

      // Navigate to main app
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Error saving kiddo details:', error);
      Alert.alert('Error', error.message || 'Failed to save details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    // Navigate to main app (skip validation)
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* App Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.appIcon}>
            <Image
              source={require('@/assets/images/android-icon-monochrome.png')}
              style={styles.appIconImage}
              contentFit="cover"
            />
          </View>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>A few details about your Kiddo</Text>
          <Text style={styles.subtitle}>So we can tailor things to their age.</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Kiddo Switcher - Show if multiple kiddos */}
          {kiddos.length > 1 && (
            <View style={styles.kiddoSwitcher}>
              {kiddos.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.kiddoSwitcherButton,
                    currentKiddoIndex === index && styles.kiddoSwitcherButtonActive,
                  ]}
                  onPress={() => setCurrentKiddoIndex(index)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.kiddoSwitcherText,
                      currentKiddoIndex === index && styles.kiddoSwitcherTextActive,
                    ]}
                  >
                    Kiddo {index + 1}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Kiddo Name */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Kiddo Name (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter kiddo name"
              placeholderTextColor={Colors.textSecondary}
              value={currentKiddo.name}
              onChangeText={(text) => updateCurrentKiddo({ name: text })}
              autoCapitalize="words"
            />
          </View>

          {/* Birth Month & Year */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Birth month & year</Text>
            <View style={styles.dateContainer}>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowMonthModal(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerButtonText, !currentKiddo.month && styles.pickerButtonPlaceholder]}>
                  {currentKiddo.month || 'Month'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowYearModal(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerButtonText, !currentKiddo.year && styles.pickerButtonPlaceholder]}>
                  {currentKiddo.year || 'Year'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>We'll calculate the age automatically.</Text>
          </View>

          {/* Gender Selection */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderContainer}>
              <TouchableOpacity
                style={[
                  styles.genderButton,
                  currentKiddo.gender === 'boy' && styles.genderButtonActive,
                ]}
                onPress={() => updateCurrentKiddo({ gender: 'boy' })}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.genderButtonText,
                    currentKiddo.gender === 'boy' && styles.genderButtonTextActive,
                  ]}
                >
                  Boy
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.genderButton,
                  currentKiddo.gender === 'girl' && styles.genderButtonActive,
                ]}
                onPress={() => updateCurrentKiddo({ gender: 'girl' })}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.genderButtonText,
                    currentKiddo.gender === 'girl' && styles.genderButtonTextActive,
                  ]}
                >
                  Girl
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.genderButton,
                  currentKiddo.gender === 'prefer-not-to-say' && styles.genderButtonActive,
                ]}
                onPress={() => updateCurrentKiddo({ gender: 'prefer-not-to-say' })}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.genderButtonText,
                    currentKiddo.gender === 'prefer-not-to-say' && styles.genderButtonTextActive,
                  ]}
                >
                  Prefer not to say
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Add Another Kiddo */}
          <TouchableOpacity 
            style={styles.addKiddoButton} 
            onPress={handleAddKiddo}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
            <Text style={styles.addKiddoText}>Add another Kiddo</Text>
          </TouchableOpacity>
          <Text style={styles.helperText}>You can add more anytime.</Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title="Continue"
          onPress={handleContinue}
          disabled={!isFormValid() || saving}
          loading={saving}
          style={styles.continueButton}
        />
        <Text style={styles.footerHelperText}>Used only to personalize your experience.</Text>
        <TouchableOpacity onPress={handleSkip} activeOpacity={0.7}>
          <Text style={styles.skipLink}>I'll do this later</Text>
        </TouchableOpacity>
      </View>

      {/* Month Picker Modal */}
      <BaseModal
        visible={showMonthModal}
        onClose={() => setShowMonthModal(false)}
        title="Select Month"
        type="bottomSheet"
      >
        <ScrollView style={styles.modalScrollView}>
          {MONTHS.map((month, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.modalOption,
                  currentKiddo.month === month && styles.modalOptionSelected,
                ]}
                onPress={() => {
                  updateCurrentKiddo({ month });
                  setShowMonthModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    currentKiddo.month === month && styles.modalOptionTextSelected,
                  ]}
                >
                  {month}
                </Text>
              {currentKiddo.month === month && (
                    <Ionicons name="checkmark" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
        </ScrollView>
      </BaseModal>

      {/* Year Picker Modal */}
      <BaseModal
        visible={showYearModal}
        onClose={() => setShowYearModal(false)}
        title="Select Year"
        type="bottomSheet"
      >
        <ScrollView style={styles.modalScrollView}>
          {YEARS.map((year) => (
            <TouchableOpacity
              key={year}
              style={[
                styles.modalOption,
                currentKiddo.year === year.toString() && styles.modalOptionSelected,
              ]}
              onPress={() => {
                updateCurrentKiddo({ year: year.toString() });
                setShowYearModal(false);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.modalOptionText,
                  currentKiddo.year === year.toString() && styles.modalOptionTextSelected,
                ]}
              >
                {year}
              </Text>
              {currentKiddo.year === year.toString() && (
                <Ionicons name="checkmark" size={20} color={Colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BaseModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  appIconImage: {
    width: '100%',
    height: '100%',
  },
  header: {
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.Bold,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.Regular,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    paddingHorizontal: 20,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.SemiBold,
    color: Colors.text,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: Fonts.Regular,
    color: Colors.text,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dateContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  pickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pickerButtonText: {
    fontSize: 16,
    fontFamily: Fonts.Regular,
    color: Colors.text,
  },
  pickerButtonPlaceholder: {
    color: Colors.textSecondary,
  },
  helperText: {
    fontSize: 12,
    fontFamily: Fonts.Regular,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  genderContainer: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  genderButton: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderButtonActive: {
    backgroundColor: '#FFF4E6',
    borderColor: '#FF6B35',
    borderWidth: 2,
  },
  genderButtonText: {
    fontSize: 14,
    fontFamily: Fonts.Medium,
    color: Colors.text,
  },
  genderButtonTextActive: {
    color: '#FF6B35',
    fontFamily: Fonts.SemiBold,
  },
  addKiddoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFF',
    marginBottom: 8,
  },
  addKiddoText: {
    fontSize: 14,
    fontFamily: Fonts.Medium,
    color: Colors.primary,
    marginLeft: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  continueButton: {
    marginBottom: 12,
  },
  footerHelperText: {
    fontSize: 12,
    fontFamily: Fonts.Regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  skipLink: {
    fontSize: 14,
    fontFamily: Fonts.Medium,
    color: Colors.primary,
    textAlign: 'center',
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalOptionSelected: {
    backgroundColor: '#FFF4E6',
  },
  modalOptionText: {
    fontSize: 16,
    fontFamily: Fonts.Regular,
    color: Colors.text,
  },
  modalOptionTextSelected: {
    fontFamily: Fonts.SemiBold,
    color: Colors.primary,
  },
  kiddoSwitcher: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  kiddoSwitcherButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFF',
    alignItems: 'center',
  },
  kiddoSwitcherButtonActive: {
    backgroundColor: '#FFF4E6',
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  kiddoSwitcherText: {
    fontSize: 14,
    fontFamily: Fonts.Medium,
    color: Colors.textSecondary,
  },
  kiddoSwitcherTextActive: {
    color: Colors.primary,
    fontFamily: Fonts.SemiBold,
  },
});

