/**
 * 云端（腾讯云开发 CloudBase）配置。
 * envId 不是密钥，直接放在客户端代码里是安全的；
 * 真正的访问控制靠数据库安全规则（doc.uid == auth.uid）。
 * 置空时应用保持纯本地可用。
 */
export const cloudbaseEnvId = 'possible-wildebeest-d1br6c84180b';
export const cloudbaseRegion = 'ap-shanghai';
