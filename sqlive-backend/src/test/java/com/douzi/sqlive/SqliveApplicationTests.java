package com.douzi.sqlive;

import com.douzi.sqlive.service.SqlExecutionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
class SqliveApplicationTests {

	@Autowired
	private ApplicationContext context;

	@Test
	void contextLoads() {
		assertNotNull(context, "Application context should load");
		assertTrue(context.getBeanDefinitionCount() > 0, "Context should have beans");
	}

	@Test
	void sqlExecutionServiceIsAvailable() {
		SqlExecutionService service = context.getBean(SqlExecutionService.class);
		assertNotNull(service, "SqlExecutionService should be in context");
	}

}
