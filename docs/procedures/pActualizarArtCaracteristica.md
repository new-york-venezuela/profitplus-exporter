# SP: pActualizarArtCaracteristica
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saArtCaracteristicaMov`](../tables/saArtCaracteristicaMov.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: [pActualizarArtCaracteristicaMov]
*DESCRIPCIÓN	: Inserta un registro en la tabla ArtCaracteristicaMOV cuando se da entrada
				  o salida una combinacion de sublineas a un articulo
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/ 

CREATE PROCEDURE [dbo].[pActualizarArtCaracteristica]
    (
		@sCo_art		CHAR(30) ,
		@sCo_lin		CHAR (6) = NULL,
		@sCo_sublin		CHAR (6) = NULL,
		@iPos			INT,
	   
		@sCo_Us_In		CHAR(6) ,
		@sCo_Sucu_In	CHAR(6) ,
		@sCo_Us_Mo		CHAR(6) ,
		@sCo_Sucu_Mo	CHAR(6) ,
		@sMaquina		VARCHAR(60) = NULL 
		
    )
AS
    BEGIN

   DECLARE @sql nvarchar(MAX), @campoLinea CHAR(20), @campoSubLinea CHAR(20)
   IF (@iPos > 5)
   
    RAISERROR ('No se pueden agregar mas de 5 caracteristicas.', 16, 1);
	
   
	SET @sql = 'DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
             UPDATE saArtCaracteristicamov set '
	+
	 CASE 
		  WHEN @iPos = 1 THEN 
		  CASE WHEN  @sCo_lin IS NULL AND @sCo_sublin IS NULL 
			THEN
				'Co_lin01 = NULL, Co_subl01 = NULL'
		       ELSE
					'Co_lin01 = ''' +  RTRIM (@sCo_lin) + ''', Co_subl01 = ''' + RTRIM (@sCo_sublin) + ''''
		  END
				
		  WHEN @iPos = 2 THEN  
		  CASE WHEN @sCo_lin IS NULL AND @sCo_sublin IS NULL
			THEN 
				'Co_lin02 = NULL, Co_subl02 = NULL'
			   ELSE
					'Co_lin02 = ''' + RTRIM (@sCo_lin) + ''',  Co_subl02 = ''' + RTRIM (@sCo_sublin) + ''''
		  END
				
	      WHEN @iPos = 3 THEN 
	      CASE WHEN @sCo_lin IS NULL AND @sCo_sublin IS NULL
			THEN 
				'Co_lin03 = NULL, Co_subl03 = NULL'
				ELSE
					'Co_lin03 = ''' + RTRIM (@sCo_lin) + ''',  Co_subl03 = ''' + RTRIM (@sCo_sublin) + ''''
		  END
		  
		  WHEN @iPos = 4 THEN 
		  CASE WHEN @sCo_lin IS NULL AND @sCo_sublin IS NULL
			THEN
				'Co_lin04 = NULL, Co_subl04 = NULL'
				ELSE
					'Co_lin04 = ''' + RTRIM (@sCo_lin) + ''',  Co_subl04 = ''' + RTRIM (@sCo_sublin) + ''''
		  END
		  WHEN @iPos = 5 THEN  
		  CASE WHEN @sCo_lin IS NULL AND @sCo_sublin IS NULL
			THEN
				'Co_lin05 = NULL, Co_subl05 = NULL'
				ELSE
				'Co_lin05 = ''' + RTRIM (@sCo_lin) + ''',  Co_subl05 = ''' + RTRIM (@sCo_sublin) + ''''
			END
		  
   END;
   Set @sql = @sql + ' OUTPUT insert
```
