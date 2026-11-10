package com.douzi.sqlive.service.ai;

import com.douzi.sqlive.config.AiProperties;
import com.douzi.sqlive.dto.ai.AiProviderConfig;
import com.douzi.sqlive.exception.AiProviderException;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * AiService branch edges: null provider configuration map and blank provider
 * name falling back to deepseek.
 */
class AiServiceEdgeCasesTest {

	private final ObjectMapper mapper = new ObjectMapper();

	@Test
	void initWithNullProvidersMapLeavesServiceEmpty() {
		var props = new AiProperties();
		props.setProviders(null);
		var service = new AiService(props, mapper);

		service.init();

		var providers = providersOf(service);
		assertTrue(providers.isEmpty(), "no provider configs → no providers");
		assertThrows(AiProviderException.class, service::getProvider);
	}

	@Test
	void blankProviderNameFallsBackToDeepSeekLookup() {
		var props = new AiProperties();
		props.setProvider("   ");
		assertDefaultDeepSeekLookup(props);
	}

	@Test
	void nullProviderNameFallsBackToDeepSeekLookup() {
		var props = new AiProperties();
		props.setProvider(null);
		assertDefaultDeepSeekLookup(props);
	}

	private void assertDefaultDeepSeekLookup(AiProperties props) {
		var service = new AiService(props, mapper);

		var deepSeek = mock(AiProvider.class);
		when(deepSeek.getProviderName()).thenReturn("deepseek");
		when(deepSeek.isAvailable()).thenReturn(true);
		ReflectionTestUtils.setField(service, "providers", Map.of("deepseek", deepSeek));

		assertEquals("deepseek", service.getProvider().getProviderName());
	}

	@Test
	void initBuildsProvidersFromConfiguration() {
		var props = new AiProperties();
		props.setProvider("deepseek");
		var config = new AiProviderConfig();
		config.setBaseUrl("http://localhost:8080");
		config.setModel("test-model");
		props.setProviders(Map.of("deepseek", config));

		var service = new AiService(props, mapper);
		service.init();

		var providers = providersOf(service);
		assertEquals(1, providers.size());
		assertEquals("deepseek", providers.get("deepseek").getProviderName());
	}

	@SuppressWarnings("unchecked")
	private static Map<String, AiProvider> providersOf(AiService service) {
		return (Map<String, AiProvider>) ReflectionTestUtils.getField(service, "providers");
	}
}
