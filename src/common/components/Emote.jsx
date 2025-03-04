import classNames from 'classnames';
import React, {useState} from 'react';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faLock} from '@fortawesome/free-solid-svg-icons/faLock';
import {createSrcSet, createSrc, DEFAULT_SIZES} from '../../utils/image.js';
import styles from './Emote.module.css';
import {hasFlag} from '../../utils/flags.js';
import {EmoteTypeFlags, SettingIds} from '../../constants.js';
import useStorageState from '../hooks/StorageState.jsx';

export default function Emote({emote, className, locked, sizes = DEFAULT_SIZES, animating = false}) {
  const imageRef = React.useRef(null);
  const loadingRef = React.useRef(true);
  const [emotesSettingValue] = useStorageState(SettingIds.EMOTES);
  const [isMouseOver, setIsMouseOver] = useState(false);

  function handleLoad() {
    window.requestAnimationFrame(() => {
      const currentImageRef = imageRef.current;
      if (currentImageRef == null) {
        return;
      }

      loadingRef.current = false;
      currentImageRef.classList.remove(styles.placeholder);
    });
  }

  function handleMouseOver() {
    setIsMouseOver(true);
  }

  function handleMouseOut() {
    setIsMouseOver(false);
  }

  const showAnimatedEmotes = hasFlag(emotesSettingValue, EmoteTypeFlags.ANIMATED_EMOTES);
  const shouldRenderStatic = !animating && !showAnimatedEmotes && !isMouseOver;

  const image = (
    <img
      ref={imageRef}
      className={classNames(className, styles.emoteImage, {
        [styles.placeholder]: loadingRef.current,
        [styles.emoteImageLocked]: locked,
      })}
      srcSet={createSrcSet(emote.images, shouldRenderStatic, sizes)}
      src={createSrc(emote.images, shouldRenderStatic, sizes[0])}
      alt={loadingRef.current ? '' : emote.code}
      onLoad={loadingRef.current ? handleLoad : undefined}
      onFocus={handleMouseOver}
      onBlur={handleMouseOut}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
    />
  );

  if (locked) {
    return (
      <div className={styles.lockedEmote}>
        {image}
        <FontAwesomeIcon icon={faLock} className={styles.lock} />
      </div>
    );
  }

  return image;
}
