package com.douzi.sqlive.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SqlRequest {
    @NotBlank(message = "SQL cannot be empty")
    @Size(max = 100000, message = "SQL script too large")
    private String sql;
    @Pattern(regexp = "^[^?&=#;/\\\\:]{0,64}$", message = "dbName contains invalid characters")
    private String dbName;
    private boolean reset;
}
