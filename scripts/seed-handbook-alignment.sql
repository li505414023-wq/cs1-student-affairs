-- 学生手册(2024)对齐种子数据
-- ①学生大队层级 ④考勤/预警 ⑤表彰奖励参数 ⑥助学金/困难补助参数 ⑦学籍异动 ⑨押金/学生干部

-- ============ ① 组织架构:学生大队(院系→大队→区队) ============
INSERT INTO managed_items (id, feature_id, code, name, description, parent_code, sort_order, status, data_json)
VALUES
  (gen_random_uuid()::text, 'corps-admin', 'corps-001', '信息工程学院学生大队', '信息工程学院学生大队', 'fac-9a882a26', 1, '启用', '{"leader":"刘大队长","gradeRange":"2024-2026"}'),
  (gen_random_uuid()::text, 'corps-admin', 'corps-002', '商学院学生大队', '商学院学生大队', 'fac-8c5b5f46', 2, '启用', '{"leader":"赵大队长","gradeRange":"2024-2026"}'),
  (gen_random_uuid()::text, 'corps-admin', 'corps-003', '智能制造学院学生大队', '智能制造学院学生大队', 'fac-5b75dcbd', 3, '启用', '{"leader":"孙大队长","gradeRange":"2024-2026"}')
ON CONFLICT (id) DO NOTHING;

-- 班级实体回填所属大队
UPDATE managed_items SET data_json = data_json || jsonb_build_object('corps',
  CASE parent_code
    WHEN 'maj-318404e1' THEN '信息工程学院学生大队'
    WHEN 'maj-0f768cab' THEN '商学院学生大队'
    WHEN 'maj-f2f6f54a' THEN '智能制造学院学生大队'
    ELSE '' END)
WHERE feature_id = 'class-admin';

-- 班级(区队)业务记录回填学生大队
UPDATE business_records
SET data_json = data_json || jsonb_build_object('学生大队', COALESCE(data_json->>'院系名称','') || '学生大队')
WHERE feature_id = 'classes';

-- ============ ⑤ 表彰奖励参数校准 ============
UPDATE business_records SET data_json = data_json || '{"评定条件":"二年级以上,学业成绩与综合素质考核成绩均列本年级本专业前35%,并获学院三等以上奖学金"}'::jsonb
WHERE feature_id='scholarship-type' AND data_json->>'种类编码'='S02';
UPDATE business_records SET data_json = data_json || '{"金额标准":"1000元/年","评定条件":"奖学金占学生总数30%(一等3%),综合素质考核按年级专业排名,院长办公会批准后公示5天"}'::jsonb
WHERE feature_id='scholarship-type' AND data_json->>'种类编码'='S03';
INSERT INTO business_records (id, feature_id, data_json, status, created_by) VALUES
  (gen_random_uuid()::text, 'scholarship-type', '{"奖学金种类":"校级二等奖学金","种类编码":"S04","等级":"校级","金额标准":"800元/年","评定条件":"占学生总数5%,综合素质考核按年级专业排名,公示5天","启用状态":"启用"}', '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2'),
  (gen_random_uuid()::text, 'scholarship-type', '{"奖学金种类":"校级三等奖学金","种类编码":"S05","等级":"校级","金额标准":"500元/年","评定条件":"占学生总数22%,综合素质考核按年级专业排名,公示5天","启用状态":"启用"}', '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2');

-- 荣誉称号种类(比例与奖金按表彰奖励办法)
INSERT INTO business_records (id, feature_id, data_json, status, created_by) VALUES
  (gen_random_uuid()::text, 'honor-type', '{"称号名称":"三好学生","称号编码":"H01","荣誉级别":"校级","适用对象":"学生","评定条件":"学生总数的10%,综合素质考核合格","启用状态":"启用"}', '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2'),
  (gen_random_uuid()::text, 'honor-type', '{"称号名称":"优秀学生干部","称号编码":"H02","荣誉级别":"校级","适用对象":"学生干部","评定条件":"参评学生干部总数的8%","启用状态":"启用"}', '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2'),
  (gen_random_uuid()::text, 'honor-type', '{"称号名称":"校级优秀毕业生","称号编码":"H03","荣誉级别":"校级","适用对象":"毕业生","评定条件":"毕业生总数的5%","启用状态":"启用"}', '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2'),
  (gen_random_uuid()::text, 'honor-type', '{"称号名称":"省级优秀毕业生","称号编码":"H04","荣誉级别":"省级","适用对象":"毕业生","评定条件":"毕业生总数的3%,执行省评选认定办法","启用状态":"启用"}', '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2'),
  (gen_random_uuid()::text, 'honor-type', '{"称号名称":"优秀团员","称号编码":"H05","荣誉级别":"校级","适用对象":"共青团员","评定条件":"团员总数的8%","启用状态":"启用"}', '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2'),
  (gen_random_uuid()::text, 'honor-type', '{"称号名称":"优秀团干部","称号编码":"H06","荣誉级别":"校级","适用对象":"团干部","评定条件":"参评团干部的8%","启用状态":"启用"}', '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2'),
  (gen_random_uuid()::text, 'honor-type', '{"称号名称":"文明宿舍","称号编码":"H07","荣誉级别":"校级","适用对象":"集体(宿舍)","评定条件":"学生宿舍总数的15%以内,奖金200元","启用状态":"启用"}', '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2'),
  (gen_random_uuid()::text, 'honor-type', '{"称号名称":"先进区队","称号编码":"H08","荣誉级别":"校级","适用对象":"集体(区队)","评定条件":"参评区队总数的20%以内,奖金500元","启用状态":"启用"}', '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2'),
  (gen_random_uuid()::text, 'honor-type', '{"称号名称":"先进班","称号编码":"H09","荣誉级别":"校级","适用对象":"集体(班级)","评定条件":"参评班总数的20%以内,奖金200元","启用状态":"启用"}', '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2'),
  (gen_random_uuid()::text, 'honor-type', '{"称号名称":"先进团支部","称号编码":"H10","荣誉级别":"校级","适用对象":"集体(团支部)","评定条件":"参评团支部总数的15%以内,奖金500元","启用状态":"启用"}', '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2');

-- 处分类型补全(留校察看/开除学籍)
INSERT INTO business_records (id, feature_id, data_json, status, created_by) VALUES
  (gen_random_uuid()::text, 'punishment-type', '{"处分类型":"留校察看","类型编码":"C04","处分等级":"四级","影响期限":"12个月(察看期)","撤销条件":"察看期内无违纪且表现突出","启用状态":"启用"}', '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2'),
  (gen_random_uuid()::text, 'punishment-type', '{"处分类型":"开除学籍","类型编码":"C05","处分等级":"五级","影响期限":"永久","撤销条件":"不可撤销","启用状态":"启用"}', '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2');

-- ============ ⑥ 助学金/困难补助参数 ============
UPDATE business_records SET data_json = data_json || '{"等级数量":"3","金额标准":"一档4500元/年,二档3000元/年,三档2000元/年","评定条件":"困难认定甲档(特别困难)4500,乙档(困难)3000,丙档(一般困难)2000;名额按在校生数20%确定"}'::jsonb
WHERE feature_id='grant-type' AND data_json->>'种类编码'='G01';
INSERT INTO business_records (id, feature_id, data_json, status, created_by) VALUES
  (gen_random_uuid()::text, 'grant-type', '{"助学金种类":"校内无息借款","种类编码":"G03","等级数量":"1","金额标准":"每生每年不超过3000元","评定条件":"家庭经济困难学生,无息","启用状态":"启用"}', '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2'),
  (gen_random_uuid()::text, 'hardship-type', '{"补助种类":"特别困难补助(一等)","种类编码":"K03","补助标准":"2000元/学年","适用对象":"认定为特别困难的学生","所需材料":"认定申请表","启用状态":"启用"}', '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2'),
  (gen_random_uuid()::text, 'hardship-type', '{"补助种类":"特别困难补助(二等)","种类编码":"K04","补助标准":"1000元/学年","适用对象":"认定为困难的学生","所需材料":"认定申请表","启用状态":"启用"}', '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2');

-- ============ ③ 课程成绩(智育数据源) ============
INSERT INTO business_records (id, feature_id, data_json, status, created_by)
SELECT gen_random_uuid()::text, 'course-scores', jsonb_build_object(
  '学年学期','2025-2026学年第二学期','姓名',s.name,'学号',s.no,'区队',s.class_name,
  '课程名称',v.course,'平时成绩',v.usual,'期末成绩',v.final,'课程成绩',v.total,'及格状态',CASE WHEN v.total >= 60 THEN '及格' ELSE '不及格' END),
  '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2'
FROM students s JOIN (VALUES
  ('20260001','公安学基础',92::int,88::int,89::int),('20260001','刑法总论',90,85,87),('20260001','大学英语',88,91,90),
  ('20250017','公安学基础',85,80,82),('20250017','刑法总论',82,78,80),('20250017','大学英语',80,75,77),
  ('20240136','公安学基础',78,82,80),('20240136','大学英语',84,80,82),
  ('20240137','公安学基础',70,66,68),('20240137','射击',75,55,63),('20240137','大学英语',60,58,59)
) AS v(no, course, usual, final, total) ON s.no = v.no;

-- ============ ④ 课前集队/晚点名考勤 + 旷课预警 ============
INSERT INTO business_records (id, feature_id, data_json, status, created_by)
SELECT gen_random_uuid()::text, 'class-attendance', jsonb_build_object(
  '日期',v.d,'集队时段','8:10','姓名',s.name,'学号',s.no,'区队',s.class_name,
  '点名结果',v.r,'缺勤原因',v.reason,'考勤状态',v.r),
  '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2'
FROM students s JOIN (VALUES
  ('20260001','2026-07-28','到齐',''),('20260001','2026-07-29','到齐',''),
  ('20250017','2026-07-28','旷课','未履行请假手续'),('20250017','2026-07-29','旷课','未履行请假手续'),
  ('20250017','2026-07-30','旷课','检查时不在且未请假'),('20250017','2026-07-31','旷课','未履行请假手续'),
  ('20250017','2026-08-01','旷课','未履行请假手续'),('20250017','2026-08-03','旷课','未履行请假手续'),
  ('20240136','2026-07-28','到齐',''),('20240137','2026-07-28','迟到','集合号后到达')
) AS v(no, d, r, reason) ON s.no = v.no;

INSERT INTO business_records (id, feature_id, data_json, status, created_by)
SELECT gen_random_uuid()::text, 'evening-rollcall', jsonb_build_object(
  '日期',v.d,'姓名',s.name,'学号',s.no,'区队',s.class_name,
  '点名结果',v.r,'缺勤原因',v.reason,'考勤状态',v.r),
  '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2'
FROM students s JOIN (VALUES
  ('20260001','2026-08-01','到齐',''),
  ('20250017','2026-08-01','旷课','晚点名未到且未请假'),
  ('20240136','2026-08-01','到齐','')
) AS v(no, d, r, reason) ON s.no = v.no;

-- 旷课预警(周言川累计7课时,达预警线未到10课时处分线)
INSERT INTO business_records (id, feature_id, data_json, status, created_by)
SELECT gen_random_uuid()::text, 'absence-warning', jsonb_build_object(
  '姓名',s.name,'学号',s.no,'区队',s.class_name,'学期','2025-2026学年第二学期',
  '累计旷课课时','7','预警等级','预警','对应处分','未达处分线(10课时警告)','更新时间','2026-08-03 20:00'),
  '预警中', NULL
FROM students s WHERE s.no = '20250017';

-- ============ ⑦ 学籍异动 ============
INSERT INTO business_records (id, feature_id, data_json, status, created_by)
SELECT gen_random_uuid()::text, 'status-change', jsonb_build_object(
  '姓名',s.name,'学号',s.no,'院系',s.faculty,'异动类型',v.t,'异动原因',v.reason,
  '生效日期',v.d,'审批部门','教务处','处理状态',v.st),
  '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2'
FROM students s JOIN (VALUES
  ('20240137','学业警示','一学期两门课程不及格,予以学业警示','2026-07-15','已办结'),
  ('20240136','复学','休学期满申请复学,附医院健康证明','2026-09-01','审核中')
) AS v(no, t, reason, d, st) ON s.no = v.no;

-- ============ ⑨ 学生干部 / 宿舍押金 ============
INSERT INTO business_records (id, feature_id, data_json, status, created_by)
SELECT gen_random_uuid()::text, 'student-cadre', jsonb_build_object(
  '姓名',s.name,'学号',s.no,'院系',s.faculty,'区队',s.class_name,
  '职务层级',v.lv,'任职职务',v.post,'任职时间',v.d,'任职状态','在任'),
  '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2'
FROM students s JOIN (VALUES
  ('20260001','区队级','区队长','2026-03-01'),
  ('20250017','区队级','学习委员','2025-09-01'),
  ('20240136','大队级','大队学生会主席','2025-09-01')
) AS v(no, lv, post, d) ON s.no = v.no;

INSERT INTO business_records (id, feature_id, data_json, status, created_by)
SELECT gen_random_uuid()::text, 'dorm-deposit', jsonb_build_object(
  '姓名',s.name,'学号',s.no,'楼栋','梧桐3号楼','房间号',v.room,'押金金额','200元',
  '缴纳日期','2026-09-01','保管人','大队长','押金状态','已缴纳'),
  '已提交', '35447fe4-8ea2-4bd8-b2da-815347a018a2'
FROM students s JOIN (VALUES
  ('20260001','216'),('20250017','305'),('20240136','118')
) AS v(no, room) ON s.no = v.no;
