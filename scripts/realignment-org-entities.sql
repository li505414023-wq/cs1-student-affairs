-- 组织架构实体与业务数据对齐:真实院系为侦查系/治安系/刑侦系,一个院系一个大队
-- 院系(实体重命名) + 大队(更名对齐) + 专业/区队(替换为真实专业区队)

-- 院系实体:更名为真实院系
UPDATE managed_items SET name='侦查系', description='侦查系' WHERE feature_id='faculty-admin' AND code='fac-9a882a26';
UPDATE managed_items SET name='治安系', description='治安系' WHERE feature_id='faculty-admin' AND code='fac-8c5b5f46';
UPDATE managed_items SET name='刑侦系', description='刑侦系' WHERE feature_id='faculty-admin' AND code='fac-5b75dcbd';

-- 大队实体:与院系 1:1 对齐
UPDATE managed_items SET name='侦查系学生大队', description='侦查系学生大队' WHERE feature_id='corps-admin' AND code='corps-001';
UPDATE managed_items SET name='治安系学生大队', description='治安系学生大队' WHERE feature_id='corps-admin' AND code='corps-002';
UPDATE managed_items SET name='刑侦系学生大队', description='刑侦系学生大队' WHERE feature_id='corps-admin' AND code='corps-003';

-- 专业实体:替换为真实专业
UPDATE managed_items SET name='侦查学', description='侦查学' WHERE feature_id='major-admin' AND code='maj-318404e1';
UPDATE managed_items SET name='治安学', description='治安学' WHERE feature_id='major-admin' AND code='maj-0f768cab';
UPDATE managed_items SET name='刑事科学技术', description='刑事科学技术' WHERE feature_id='major-admin' AND code='maj-f2f6f54a';

-- 区队(班级)实体:替换为真实区队
UPDATE managed_items SET name='侦查2601区队', description='侦查2601区队',
  data_json=data_json||'{"corps":"侦查系学生大队"}'::jsonb
  WHERE feature_id='class-admin' AND code='cls-fa7ce116';
UPDATE managed_items SET name='治安2601区队', description='治安2601区队',
  data_json=data_json||'{"corps":"治安系学生大队"}'::jsonb
  WHERE feature_id='class-admin' AND code='cls-6e4fa3f9';
UPDATE managed_items SET name='刑侦2501区队', description='刑侦2501区队',
  data_json=data_json||'{"corps":"刑侦系学生大队"}'::jsonb
  WHERE feature_id='class-admin' AND code='cls-65842a14';

-- 班级业务记录:修正早期回填的学生大队名称
UPDATE business_records SET data_json = data_json || jsonb_build_object('学生大队',
  CASE data_json->>'院系名称'
    WHEN '侦查系' THEN '侦查系学生大队'
    WHEN '治安系' THEN '治安系学生大队'
    WHEN '刑侦系' THEN '刑侦系学生大队'
    ELSE COALESCE(data_json->>'院系名称','') || '学生大队' END)
WHERE feature_id = 'classes';
