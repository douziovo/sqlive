package com.douzi.sqlive.controller;

import com.douzi.sqlive.dto.SqlRequest;
import com.douzi.sqlive.dto.SqlResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SqlControllerTest {

	private final RestTemplate restTemplate = new RestTemplate();
	@Value("${local.server.port}")
	private int port;
	private String dbSuffix;

	@BeforeEach
	void generateDbSuffix() {
		dbSuffix = UUID.randomUUID().toString().substring(0, 8);
	}

	private String db(String prefix) {
		return prefix + "_" + dbSuffix;
	}

	private String url() {
		return SqlControllerTestSupport.url(port);
	}

	private SqlResponse post(SqlRequest req) {
		return SqlControllerTestSupport.postForBody(restTemplate, port, req);
	}

	@Test
	void shouldExecuteSimpleSql() {
		SqlRequest req = new SqlRequest();
		req.setSql("CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (1); SELECT * FROM t;");
		req.setDbName(db("ctrl_test"));
		req.setReset(true);

		SqlResponse body = post(req);
		assertNotNull(body);
		assertTrue(body.getError() == null);
		assertEquals(1, body.getData().getTables().size());
		assertEquals("t", body.getData().getTables().getFirst().getName());
		assertEquals(1, body.getData().getQueryResults().size());
	}

	@Test
	void shouldReturnErrorForInvalidSql() {
		SqlRequest req = new SqlRequest();
		req.setSql("NOT VALID SQL;");
		req.setDbName(db("error_ctrl"));
		req.setReset(true);

		SqlResponse body = post(req);
		assertNotNull(body);
		assertFalse(body.getError() == null);
		assertNotNull(body.getError());
		assertNotNull(body.getError().getMessage());
	}

	@Test
	void shouldRejectEmptyScript() {
		SqlRequest req = new SqlRequest();
		req.setSql("");
		req.setDbName(db("empty_ctrl"));
		req.setReset(true);

		SqlResponse body = post(req);
		assertNotNull(body);
		assertFalse(body.getError() == null);
		assertNotNull(body.getError());
		assertTrue(body.getError().getMessage().contains("SQL cannot be empty"));
	}

	@Test
	void shouldIsolateDatabasesByName() {
		SqlRequest req1 = new SqlRequest();
		req1.setSql("CREATE TABLE a (x INTEGER); INSERT INTO a VALUES (1);");
		req1.setDbName(db("iso_a"));
		req1.setReset(true);

		SqlRequest req2 = new SqlRequest();
		req2.setSql("CREATE TABLE b (y TEXT); INSERT INTO b VALUES ('hello');");
		req2.setDbName(db("iso_b"));
		req2.setReset(true);

		post(req1);
		post(req2);

		SqlRequest checkA = new SqlRequest();
		checkA.setSql("SELECT name FROM sqlite_master WHERE type='table';");
		checkA.setDbName(db("iso_a"));
		checkA.setReset(false);

		SqlResponse respA = post(checkA);
		assertTrue(respA.getError() == null);
		assertEquals(1, respA.getData().getTables().size());
		assertEquals("a", respA.getData().getTables().getFirst().getName());
	}

	@Test
	void shouldReportMetadata() {
		SqlRequest req = new SqlRequest();
		req.setSql("CREATE TABLE t (id INTEGER); INSERT INTO t VALUES (1);");
		req.setDbName(db("meta_ctrl"));
		req.setReset(true);

		SqlResponse body = post(req);
		assertNotNull(body);
		assertTrue(body.getError() == null);
		assertNotNull(body.getData().getMetadata());
		assertTrue(body.getData().getMetadata().getDurationMs() >= 0);
		assertTrue(body.getData().getMetadata().getStatementCount() >= 2);
	}

	@Test
	void failedRecreatedSessionExposesItsRecoveryHeaderAcrossOrigins() {
		SqlRequest request = new SqlRequest();
		request.setSql("SELECT * FROM missing;");
		request.setDbName(db("recreated_cors"));
		request.setReset(false);
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);
		headers.setOrigin("http://localhost:5173");
		var corsClient = new RestTemplate(new JdkClientHttpRequestFactory());
		var response = corsClient.exchange(url(), HttpMethod.POST,
				new HttpEntity<>(request, headers), SqlResponse.class);
		assertNotNull(response.getBody().getError());
		assertEquals("true", response.getHeaders().getFirst("X-Session-Recreated"));
		assertTrue(response.getHeaders().getAccessControlExposeHeaders().contains("X-Session-Recreated"));
		assertTrue(response.getHeaders().getAccessControlExposeHeaders().contains("Retry-After"));
	}
}
