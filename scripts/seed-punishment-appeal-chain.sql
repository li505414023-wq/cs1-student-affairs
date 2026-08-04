-- 处分→操行联动→申诉 链路演示数据(与 records-hooks 联动字段键名完全一致)
-- 周言川(20250017): 旷课累计受警告处分 → 操行分联动减10 → 本人10日内申诉

INSERT INTO business_records (id, feature_id, data_json, status, created_by)
SELECT gen_random_uuid()::text, 'punishment', jsonb_build_object(
  '姓名',s.name,'学号',s.no,'区队',s.class_name,'院系',s.faculty,
  '处分类型','警告','违纪事实','一学期累计旷课7课时(课前集队6次,晚点名1次),接近10课时警告处分线,经研究决定给予警告处分',
  '处分日期','2026-07-30','处分期','6个月','处分状态','生效中'),
  '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2'
FROM students s WHERE s.no = '20250017';

-- 处分联动操行分减分(与 afterRecordCreated 生成的记录同构)
INSERT INTO business_records (id, feature_id, data_json, status, created_by)
SELECT gen_random_uuid()::text, 'conduct-score', jsonb_build_object(
  '姓名',s.name,'学号',s.no,'区队',s.class_name,
  '加减分','扣分','分值','10','事由','警告处分联动减分',
  '记录日期','2026-07-30','记录人','系统联动'),
  '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2'
FROM students s WHERE s.no = '20250017';

-- 学生本人在申诉时限内提交申诉(created_by=学生账号,学生端可见可查)
INSERT INTO business_records (id, feature_id, data_json, status, created_by)
SELECT gen_random_uuid()::text, 'appeal', jsonb_build_object(
  '姓名',s.name,'学号',s.no,'区队',s.class_name,
  '处分类型','警告','处分决定书日期','2026-07-30','申诉提交日期','2026-08-02',
  '申诉理由','本人承认旷课事实,但其中两次因身体不适未能及时请假,请求复核并减轻处分',
  '处理状态','学申委受理中'),
  '已提交', s.user_id
FROM students s WHERE s.no = '20250017' AND s.user_id IS NOT NULL;
