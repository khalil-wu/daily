import { Platform } from 'react-native';

/** 网页上按住图片拖动会触发浏览器原生拖图并取消指针，导致书架拖动 / 翻页手势中断 */
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('jide-no-img-drag')) {
  const style = document.createElement('style');
  style.id = 'jide-no-img-drag';
  style.textContent = 'img{-webkit-user-drag:none;user-drag:none}';
  document.head.appendChild(style);
}
