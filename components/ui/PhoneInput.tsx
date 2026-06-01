import { Colors, Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TextInput, View } from 'react-native';

interface PhoneInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  editable?: boolean;
  error?: boolean;
}

export function PhoneInput({
  value,
  onChangeText,
  placeholder = 'Your number here',
  editable = true,
  error = false,
}: PhoneInputProps) {
  return (
    <View style={[styles.wrapper, error && styles.wrapperError]}>
      <View style={styles.countrySelector}>
        <Text style={styles.countryText}>IN +91</Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={Colors.textSecondary}
          style={styles.chevronIcon}
        />
      </View>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        keyboardType="phone-pad"
        maxLength={10}
        autoFocus={false}
        editable={editable}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#D5D7DA',
    minHeight: 52,
  },
  wrapperError: {
    borderColor: '#F04438',
    backgroundColor: '#FEF2F2',
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    paddingRight: 12,
    borderRightWidth: 0, // In screenshot there is no separator line, just a gap
  },
  countryText: {
    fontSize: Fonts.MediumFontSize,
    fontFamily: Fonts.LexendRegular,
    color: '#535862',
    marginRight: 4,
  },
  chevronIcon: {
    marginTop: 2,
  },
  input: {
    flex: 1,
    fontSize: Fonts.MediumFontSize,
    color: '#181D27',
    padding: 0,
    fontFamily: Fonts.LexendSemiBold,
  },
});

