import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';

import Ionicons from '@react-native-vector-icons/ionicons';

import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';

const Header = ({
  title,
  onSearchPress,
}) => {

  const [profileImage, setProfileImage] = useState(null);

  // ---------------- FETCH USER IMAGE ----------------
  useEffect(() => {
    const uid = auth().currentUser?.uid;

    if (!uid) return;

    const ref = database().ref(`/users/${uid}`);

    ref.on('value', snapshot => {
      const data = snapshot.val();

      if (data?.profileImage) {
        setProfileImage(data.profileImage);
      }
    });

    return () => ref.off();
  }, []);

  return (
    <View style={styles.header}>

      {/* LEFT SIDE */}
      <View style={styles.leftContainer}>

        <Image
          source={{
            uri:
              profileImage && profileImage !== ''
                ? profileImage
                : '',
          }}
          style={styles.profileImage}
        />

        <Text style={styles.title}>{title}</Text>

      </View>

      {/* SEARCH ICON */}
      <TouchableOpacity onPress={onSearchPress}>
        <Ionicons
          name="search-outline"
          size={28}
          color="#1664d9"
        />
      </TouchableOpacity>

    </View>
  );
};

export default Header;

const styles = StyleSheet.create({
  header: {
    height: 90,
    backgroundColor: '#f4f4f8',
    paddingTop: 25,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },

  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  profileImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 14,
  },

  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1664d9',
  },
});