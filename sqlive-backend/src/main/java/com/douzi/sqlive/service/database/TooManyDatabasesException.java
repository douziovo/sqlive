package com.douzi.sqlive.service.database;

public class TooManyDatabasesException extends RuntimeException {
	public TooManyDatabasesException(String message) {
		super(message);
	}
}
