/**
 * 默认 SQL 脚本 - SQLite 多表查询演示（含索引、视图、触发器）
 */
export const DEFAULT_SQL = `-- =============================================
-- SQLite 多表查询测试 SQL（含索引）
-- =============================================
-- 1. 部门表
CREATE TABLE departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT,
    budget REAL DEFAULT 0
);

-- 2. 员工表（外键关联部门）
CREATE TABLE employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    age INTEGER CHECK (
        age > 0
        AND age < 100
    ),
    salary REAL NOT NULL,
    dept_id INTEGER NOT NULL REFERENCES departments (id),
    hire_date TEXT NOT NULL,
    email TEXT UNIQUE
);

-- 3. 项目表
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    budget REAL
);

-- 4. 员工-项目 多对多关联表
CREATE TABLE employee_projects (
    emp_id INTEGER NOT NULL REFERENCES employees (id),
    project_id INTEGER NOT NULL REFERENCES projects (id),
    role TEXT,
    hours INTEGER DEFAULT 0,
    PRIMARY KEY (emp_id, project_id)
);

-- =============================================
-- 索引
-- =============================================
-- 单列索引：按部门查员工
CREATE INDEX idx_employees_dept ON employees (dept_id);

-- 唯一索引：邮箱唯一
CREATE UNIQUE INDEX idx_employees_email ON employees (email);

-- 复合索引：按部门和薪资范围查询
CREATE INDEX idx_employees_dept_salary ON employees (dept_id, salary);

-- 按入职日期排序查询
CREATE INDEX idx_employees_hire_date ON employees (hire_date);

-- 关联表索引
CREATE INDEX idx_emp_proj_project ON employee_projects (project_id);

-- 表达式索引（SQLite 3.9+ 支持）：按员工姓名小写搜索
CREATE INDEX idx_employees_name_lower ON employees (LOWER(name));

-- 部分索引：仅高薪员工
CREATE INDEX idx_employees_high_salary ON employees (salary)
WHERE
    salary > 10000;

-- =============================================
-- SQLite 全数据类型演示表
-- =============================================
CREATE TABLE type_demo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- 存储类：INTEGER
    col_integer INTEGER,
    col_int INT,
    col_tinyint TINYINT,
    col_smallint SMALLINT,
    col_mediumint MEDIUMINT,
    col_bigint BIGINT,
    col_int2 INT2,
    col_int8 INT8,
    col_unsigned_big_int UNSIGNED BIG INT,
    -- 存储类：REAL
    col_real REAL,
    col_double DOUBLE,
    col_double_precision DOUBLE PRECISION,
    col_float FLOAT,
    -- 存储类：TEXT
    col_text TEXT,
    col_character CHARACTER(20),
    col_varchar VARCHAR(50),
    col_varying_character VARYING CHARACTER(30),
    col_nchar NCHAR(10),
    col_native_character NATIVE CHARACTER(20),
    col_nvarchar NVARCHAR(40),
    col_clob CLOB,
    -- 存储类：NUMERIC
    col_numeric NUMERIC,
    col_decimal DECIMAL(10, 2),
    col_boolean BOOLEAN,
    col_date DATE,
    col_datetime DATETIME,
    -- 存储类：BLOB
    col_blob BLOB,
    -- 约束组合
    col_not_null TEXT NOT NULL DEFAULT 'default_val',
    col_unique TEXT UNIQUE,
    col_check INTEGER CHECK (col_check >= 0)
);

-- =============================================
-- 视图
-- =============================================
-- 员工完整信息视图（跨3表 JOIN）
CREATE VIEW v_employee_full AS
SELECT
    e.id AS emp_id,
    e.name AS emp_name,
    e.age,
    e.salary,
    e.hire_date,
    d.name AS dept_name,
    d.location AS dept_location,
    COUNT(ep.project_id) AS project_count,
    COALESCE(SUM(ep.hours), 0) AS total_hours
FROM
    employees e
    JOIN departments d ON e.dept_id = d.id
    LEFT JOIN employee_projects ep ON e.id = ep.emp_id
GROUP BY
    e.id;

-- 项目概览视图
CREATE VIEW v_project_summary AS
SELECT
    p.id,
    p.name,
    p.start_date,
    p.end_date,
    p.budget,
    COUNT(ep.emp_id) AS member_count,
    COALESCE(SUM(ep.hours), 0) AS total_work_hours,
    ROUND(p.budget / NULLIF(COUNT(ep.emp_id), 0), 2) AS budget_per_member
FROM
    projects p
    LEFT JOIN employee_projects ep ON p.id = ep.project_id
GROUP BY
    p.id;

-- 部门薪资统计视图
CREATE VIEW v_dept_salary_stats AS
SELECT
    d.name,
    COUNT(e.id) AS emp_count,
    ROUND(MIN(e.salary), 2) AS min_salary,
    ROUND(MAX(e.salary), 2) AS max_salary,
    ROUND(AVG(e.salary), 2) AS avg_salary,
    ROUND(SUM(e.salary), 2) AS total_salary
FROM
    departments d
    LEFT JOIN employees e ON d.id = e.dept_id
GROUP BY
    d.id;

-- 高薪员工视图
CREATE VIEW v_high_salary_employees AS
SELECT
    e.name,
    e.salary,
    d.name AS dept_name
FROM
    employees e
    JOIN departments d ON e.dept_id = d.id
WHERE
    e.salary > 15000
ORDER BY
    e.salary DESC;

-- =============================================
-- 触发器
-- =============================================
-- 审计日志表
CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    old_data TEXT,
    new_data TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 员工插入触发器：自动记录审计日志
CREATE TRIGGER trg_employees_insert AFTER INSERT ON employees BEGIN
INSERT INTO
    audit_log (table_name, operation, new_data)
VALUES
    (
        'employees',
        'INSERT',
        'id=' || NEW.id || ', name=' || NEW.name || ', salary=' || NEW.salary
    );

END;

-- 员工更新触发器：记录变更前后数据
CREATE TRIGGER trg_employees_update AFTER
UPDATE ON employees BEGIN
INSERT INTO
    audit_log (table_name, operation, old_data, new_data)
VALUES
    (
        'employees',
        'UPDATE',
        'name=' || OLD.name || ', salary=' || OLD.salary,
        'name=' || NEW.name || ', salary=' || NEW.salary
    );

END;

-- 员工删除触发器：记录被删除的数据
CREATE TRIGGER trg_employees_delete AFTER DELETE ON employees BEGIN
INSERT INTO
    audit_log (table_name, operation, old_data)
VALUES
    (
        'employees',
        'DELETE',
        'id=' || OLD.id || ', name=' || OLD.name || ', salary=' || OLD.salary
    );

END;

-- BEFORE 触发器：自动设置项目结束日期（如果未指定则设为开始日期后1年）
CREATE TRIGGER trg_projects_default_end_date BEFORE INSERT ON projects BEGIN
UPDATE projects
SET
    end_date = CASE
        WHEN NEW.end_date IS NULL
        AND NEW.start_date IS NOT NULL THEN date(NEW.start_date, '+1 year')
        ELSE NEW.end_date
    END
WHERE
    id = NEW.id;

END;

-- BEFORE 触发器：薪资校验（不允许低于最低工资）
CREATE TRIGGER trg_employees_salary_check BEFORE INSERT ON employees BEGIN
SELECT
    CASE
        WHEN NEW.salary < 3000 THEN RAISE (ABORT, '薪资不能低于 3000')
    END;

END;

-- =============================================
-- 数据
-- =============================================
INSERT INTO
    departments
VALUES
    (1, '技术部', '北京', 500000);

INSERT INTO
    departments
VALUES
    (2, '市场部', '上海', 300000);

INSERT INTO
    departments
VALUES
    (3, '人事部', '广州', 150000);

INSERT INTO
    departments
VALUES
    (4, '财务部', '深圳', 200000);

INSERT INTO
    employees
VALUES
    (
        1,
        '张三',
        28,
        15000,
        1,
        '2020-03-15',
        'zhangsan@example.com'
    );

INSERT INTO
    employees
VALUES
    (
        2,
        '李四',
        32,
        18000,
        1,
        '2019-07-01',
        'lisi@example.com'
    );

INSERT INTO
    employees
VALUES
    (
        3,
        '王五',
        26,
        12000,
        1,
        '2021-01-10',
        'wangwu@example.com'
    );

INSERT INTO
    employees
VALUES
    (
        4,
        '赵六',
        35,
        20000,
        2,
        '2018-05-20',
        'zhaoliu@example.com'
    );

INSERT INTO
    employees
VALUES
    (
        5,
        '孙七',
        29,
        9500,
        2,
        '2020-11-01',
        'sunqi@example.com'
    );

INSERT INTO
    employees
VALUES
    (
        6,
        '周八',
        40,
        22000,
        3,
        '2017-02-14',
        'zhouba@example.com'
    );

INSERT INTO
    employees
VALUES
    (
        7,
        '吴九',
        24,
        8000,
        3,
        '2022-06-30',
        'wujiu@example.com'
    );

INSERT INTO
    employees
VALUES
    (
        8,
        '郑十',
        31,
        17000,
        4,
        '2019-09-09',
        'zhengshi@example.com'
    );

INSERT INTO
    projects
VALUES
    (1, '云平台重构', '2022-01-01', '2022-12-31', 200000);

INSERT INTO
    projects
VALUES
    (2, '移动App开发', '2022-03-01', '2023-06-30', 150000);

INSERT INTO
    projects
VALUES
    (3, '数据分析系统', '2022-06-01', NULL, 100000);

INSERT INTO
    employee_projects
VALUES
    (1, 1, '架构师', 120);

INSERT INTO
    employee_projects
VALUES
    (2, 1, '后端开发', 200);

INSERT INTO
    employee_projects
VALUES
    (3, 1, '前端开发', 180);

INSERT INTO
    employee_projects
VALUES
    (1, 2, '技术顾问', 60);

INSERT INTO
    employee_projects
VALUES
    (4, 2, '产品经理', 100);

INSERT INTO
    employee_projects
VALUES
    (5, 2, 'UI设计', 160);

INSERT INTO
    employee_projects
VALUES
    (2, 3, '数据工程师', 150);

INSERT INTO
    employee_projects
VALUES
    (6, 3, '数据分析师', 120);

-- 类型演示数据
INSERT INTO
    type_demo (
        col_integer,
        col_int,
        col_tinyint,
        col_smallint,
        col_mediumint,
        col_bigint,
        col_real,
        col_double,
        col_float,
        col_text,
        col_character,
        col_varchar,
        col_nchar,
        col_nvarchar,
        col_clob,
        col_numeric,
        col_decimal,
        col_boolean,
        col_date,
        col_datetime,
        col_blob,
        col_not_null,
        col_unique,
        col_check
    )
VALUES
    (
        42,
        -100,
        127,
        32767,
        8388607,
        9223372036854775807,
        3.141592653589793,
        2.718281828459045,
        1.4142135623730951,
        'Hello SQLite',
        'CHAR text',
        'VARCHAR text',
        'NCHAR',
        'NVARCHAR text',
        'CLOB long text data here',
        99.99,
        12345.67,
        1,
        '2024-01-15',
        '2024-06-20 14:30:00',
        X'DEADBEEF',
        'not null value',
        'unique_value_1',
        100
    );

INSERT INTO
    type_demo (
        col_integer,
        col_int,
        col_bigint,
        col_real,
        col_double,
        col_text,
        col_varchar,
        col_nvarchar,
        col_numeric,
        col_decimal,
        col_boolean,
        col_date,
        col_datetime,
        col_not_null,
        col_unique,
        col_check
    )
VALUES
    (
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        0,
        NULL,
        NULL,
        'nullable test',
        'unique_value_2',
        0
    );

-- =============================================
-- 多表查询
-- =============================================
-- Q1: INNER JOIN — 员工+部门
SELECT
    e.name AS 员工,
    d.name AS 部门,
    e.salary AS 薪资
FROM
    employees e
    INNER JOIN departments d ON e.dept_id = d.id;

-- Q2: LEFT JOIN — 所有员工参与项目情况
SELECT
    e.name,
    p.name AS project,
    ep.role
FROM
    employees e
    LEFT JOIN employee_projects ep ON e.id = ep.emp_id
    LEFT JOIN projects p ON ep.project_id = p.id;

-- Q3: 聚合 + GROUP BY — 部门平均薪资
SELECT
    d.name,
    COUNT(e.id) AS 人数,
    ROUND(AVG(e.salary), 2) AS 平均薪资
FROM
    departments d
    LEFT JOIN employees e ON d.id = e.dept_id
GROUP BY
    d.id
HAVING
    平均薪资 > 10000;

-- Q4: 子查询 — 薪资高于部门平均的员工
SELECT
    e.name,
    e.salary,
    d.name AS dept
FROM
    employees e
    JOIN departments d ON e.dept_id = d.id
WHERE
    e.salary > (
        SELECT
            AVG(e2.salary)
        FROM
            employees e2
        WHERE
            e2.dept_id = e.dept_id
    );

-- Q5: 三表 JOIN — 项目成员明细
SELECT
    p.name AS 项目,
    e.name AS 员工,
    ep.role AS 角色,
    ep.hours AS 工时
FROM
    employee_projects ep
    JOIN employees e ON ep.emp_id = e.id
    JOIN projects p ON ep.project_id = p.id
ORDER BY
    p.name,
    ep.hours DESC;

-- Q6: EXISTS 子查询 — 有参与项目的员工
SELECT
    e.name,
    d.name AS dept
FROM
    employees e
    JOIN departments d ON e.dept_id = d.id
WHERE
    EXISTS (
        SELECT
            1
        FROM
            employee_projects ep
        WHERE
            ep.emp_id = e.id
    );

-- Q7: UNION — 各部门薪资最高和最低的员工
SELECT
    e.name,
    e.salary,
    d.name AS dept,
    '最高' AS 类型
FROM
    employees e
    JOIN departments d ON e.dept_id = d.id
WHERE
    (e.dept_id, e.salary) IN (
        SELECT
            dept_id,
            MAX(salary)
        FROM
            employees
        GROUP BY
            dept_id
    )
UNION ALL
SELECT
    e.name,
    e.salary,
    d.name,
    '最低'
FROM
    employees e
    JOIN departments d ON e.dept_id = d.id
WHERE
    (e.dept_id, e.salary) IN (
        SELECT
            dept_id,
            MIN(salary)
        FROM
            employees
        GROUP BY
            dept_id
    )
ORDER BY
    dept,
    类型;

-- Q8: 窗口函数（SQLite 3.25+）— 部门内薪资排名
SELECT
    e.name,
    d.name AS dept,
    e.salary,
    RANK() OVER (
        PARTITION BY
            e.dept_id
        ORDER BY
            e.salary DESC
    ) AS 排名
FROM
    employees e
    JOIN departments d ON e.dept_id = d.id;
`;
