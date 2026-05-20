import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';

import Ionicons from '@react-native-vector-icons/ionicons';

import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';

const UsernameScreen = ({ route, navigation }) => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);


  const saveUser = async () => {
  if (!username.trim()) {
    Alert.alert('Enter username');
    return;
  }

  try {
    setLoading(true);

    const { uid, phoneNumber } = route.params || {};

    await database().ref(`/users/${uid}`).set({
      uid,
      username,
      phoneNumber,
      createdAt: Date.now(),
      online: true,
    });

    navigation.reset({
      index: 0,
      routes: [{ name: 'Tabnavigation' }],
    });

  } catch (error) {
    Alert.alert('Error', error.message);
  } finally {
    setLoading(false);
  }
};

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Top Icon */}
        <View style={styles.iconWrapper}>
          <Ionicons name="person-outline" size={28} color="#1d4ed8" />
        </View>

        {/* Heading */}
        <Text style={styles.heading}>Choose your username</Text>

        <Text style={styles.subText}>
          This is how your friends and teammates will identify you in
          conversations.
        </Text>

        {/* Username Label */}
        <Text style={styles.label}>Username</Text>

        {/* Input */}
        <View style={styles.inputContainer}>
          <Ionicons
            name="at-outline"
            size={18}
            color="#9ca3af"
            style={styles.inputIcon}
          />

          <TextInput
            placeholder="alex_smith"
            placeholderTextColor="#9ca3af"
            value={username}
            onChangeText={setUsername}
            style={styles.input}
          />
        </View>

        {/* Hint */}
        <Text style={styles.hint}>
          Must be at least 3 characters. Use letters, numbers, or underscores.
        </Text>

        {/* Info Boxes */}
        <View style={styles.infoRow}>
          <View style={styles.infoBox}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color="#2563eb"
            />
            <Text style={styles.infoTitle}>Unique handle</Text>
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="create-outline" size={18} color="#16a34a" />
            <Text style={styles.infoTitle}>Change anytime</Text>
          </View>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={saveUser}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.buttonText}>Continue</Text>
              <Ionicons
                name="arrow-forward"
                size={18}
                color="#fff"
                style={{ marginLeft: 8 }}
              />
            </>
          )}
        </TouchableOpacity>

        {/* Bottom Text */}
        <TouchableOpacity>
          <Text style={styles.bottomText}>
            Already have an account?{' '}
            <Text
              style={styles.loginText}
              onPress={() => navigation.navigate('Login')}
            >
              Log in
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default UsernameScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f5',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 35,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 5,
  },

  iconWrapper: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 25,
  },

  heading: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    lineHeight: 38,
  },

  subText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 22,
    marginBottom: 35,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },

  inputContainer: {
    height: 56,
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },

  inputIcon: {
    marginRight: 8,
  },

  input: {
    flex: 1,
    color: '#111827',
    fontSize: 16,
  },

  hint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 10,
    lineHeight: 18,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 32,
  },

  infoBox: {
    flex: 0.48,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },

  infoTitle: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },

  button: {
    height: 58,
    backgroundColor: '#0b5ed7',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    shadowColor: '#0b5ed7',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  bottomText: {
    textAlign: 'center',
    marginTop: 28,
    color: '#6b7280',
    fontSize: 13,
  },

  loginText: {
    color: '#0b5ed7',
    fontWeight: '700',
  },
});
