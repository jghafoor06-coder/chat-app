import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  PermissionsAndroid,
  Modal,
  ActivityIndicator,
  Animated,
} from 'react-native';

import React, { useEffect, useState, useRef } from 'react';
import Header from '../components/Header';
import Ionicons from '@react-native-vector-icons/ionicons';

import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import storage from '@react-native-firebase/storage';

import { launchImageLibrary } from 'react-native-image-picker';

const SettingItem = React.memo(({ icon, title, color }) => {
  return (
    <View style={styles.item}>
      <View style={[styles.iconBox, { backgroundColor: color }]}>
        <Ionicons name={icon} size={20} color="#111827" />
      </View>

      <Text style={styles.itemText}>{title}</Text>

      <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
    </View>
  );
});

const ProfileScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [imageVisible, setImageVisible] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const pageAnim = useRef(new Animated.Value(0)).current;

  const uid = auth().currentUser?.uid;

  // FETCH USER DATA
  useEffect(() => {
    if (!uid) return;

    const ref = database().ref(`/users/${uid}`);

    ref.on('value', snapshot => {
      const data = snapshot.val();

      if (data?.username) setUsername(data.username);
      if (data?.profileImage) setProfileImage(data.profileImage);
    });

    return () => ref.off();
  }, [uid]);

  // PERMISSION
  const requestPermission = async () => {
    if (Platform.OS !== 'android') return true;

    const permission =
      Platform.Version >= 33
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

    const result = await PermissionsAndroid.request(permission, {
      title: 'Photo Access',
      message: 'Need photo access for profile picture',
      buttonPositive: 'Allow',
    });

    return result === PermissionsAndroid.RESULTS.GRANTED;
  };

  // PICK IMAGE
  const pickImage = async () => {
    const hasPermission = await requestPermission();

    if (!hasPermission) {
      Alert.alert('Permission denied', 'Storage access is required');
      return;
    }

    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    });

    if (result.didCancel) return;

    const asset = result.assets?.[0];
    if (!asset?.uri) return;

    if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024) {
      Alert.alert('Error', 'Image must be under 2MB');
      return;
    }

    setImageLoading(true);

    try {
      const imageRef = storage().ref(`profileImages/${uid}.jpg`);

      await imageRef.putFile(asset.uri);

      const downloadURL = await imageRef.getDownloadURL();

      await database().ref(`/users/${uid}`).update({
        profileImage: downloadURL,
      });

      setProfileImage(downloadURL);
    } catch (error) {
      Alert.alert('Upload Failed', error.message);
    } finally {
      setImageLoading(false);
    }
  };

  // LOGOUT FLOW
  const handleLogout = async () => {
    try {
      await auth().signOut();
      navigation.navigate('authstack');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  useEffect(() => {
    Animated.spring(pageAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={styles.main}>
      <Header title="Settings" />

      <ScrollView showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            styles.container,
            {
              opacity: pageAnim,
              transform: [
                {
                  translateY: pageAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* PROFILE IMAGE */}
          <View style={styles.imageWrapper}>
            <TouchableOpacity onPress={() => setImageVisible(true)} activeOpacity={0.6}>
              <Image
                source={{
                  uri: profileImage ? profileImage : '',
                }}
                style={styles.profileImage}
              />
            </TouchableOpacity>

            {imageLoading && (
              <View style={styles.imageLoaderOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color="#0b5ed7" />
              </View>
            )}

            <TouchableOpacity
              style={styles.editIconWrapper}
              onPress={pickImage}
            >
              <View style={styles.editicon}>
                <Ionicons name="pencil" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>

          {/* USERNAME */}
          <Text style={styles.username}>
            {username ? username : 'Loading...'}
          </Text>

          <Text style={styles.bio}>
            Focused on building meaningful connections.
          </Text>

          <Text style={styles.emoji}>🚀</Text>

          {/* SETTINGS */}
          <View style={styles.card}>
            <SettingItem
              icon="person-outline"
              title="Account"
              color="#dbeafe"
            />
            <View style={styles.line} />
            <SettingItem
              icon="lock-closed-outline"
              title="Privacy"
              color="#dcfce7"
            />
            <View style={styles.line} />
            <SettingItem
              icon="notifications-outline"
              title="Notifications"
              color="#ffedd5"
            />
          </View>

          <View style={styles.card}>
            <SettingItem
              icon="help-circle-outline"
              title="Help"
              color="#e5e7eb"
            />
            <View style={styles.line} />
            <SettingItem
              icon="information-circle-outline"
              title="About"
              color="#e5e7eb"
            />
          </View>

          {/* LOGOUT */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color="#dc2626" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </Animated.View>

        // IMAGE MODAL
        <Modal
          visible={imageVisible}
          transparent={true}
          onRequestClose={() => setImageVisible(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'black',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {/* CLOSE BUTTON */}
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: 40,
                right: 20,
                zIndex: 1,
              }}
              onPress={() => setImageVisible(false)}
            >
              <Text style={{ color: 'white', fontSize: 25 }}>✕</Text>
            </TouchableOpacity>

            {/* FULL IMAGE */}
            <Image
              source={{ uri: profileImage }}
              style={{
                width: '100%',
                height: '80%',
                resizeMode: 'contain',
              }}
            />
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  main: {
    flex: 1,
    backgroundColor: '#f5f7fb',
    overflow: 'hidden',
  },

  container: {
    paddingHorizontal: 16,
    paddingTop: 25,
    paddingBottom: 40,
    alignItems: 'center',
  },

  imageWrapper: {
    position: 'relative',
  },

  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#fff',
  },

  editIconWrapper: {
    position: 'absolute',
    bottom: 4,
    right: 2,
  },

  imageLoaderOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 60,
  },

  editicon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0b5ed7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },

  username: {
    marginTop: 18,
    fontSize: 34,
    fontWeight: '800',
    color: '#111827',
  },

  bio: {
    marginTop: 6,
    fontSize: 15,
    color: '#4b5563',
    textAlign: 'center',
  },

  emoji: {
    marginTop: 6,
    fontSize: 20,
  },

  card: {
    width: '100%',
    backgroundColor: '#fff',
    marginTop: 24,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
  },

  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },

  itemText: {
    flex: 1,
    marginLeft: 14,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },

  line: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginLeft: 56,
  },

  logoutBtn: {
    width: '100%',
    height: 58,
    backgroundColor: '#fff',
    borderRadius: 18,
    marginTop: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#fecaca',
  },

  logoutText: {
    color: '#dc2626',
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 8,
  },

});
