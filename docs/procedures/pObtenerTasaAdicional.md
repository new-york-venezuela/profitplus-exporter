# SP: pObtenerTasaAdicional
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saTasa`](../tables/saTasa.md)

## Código (excerpt)
```sql
-- =============================================
-- CREADO			:	<2011-12-12>
-- MODIFICADO		:	<2020-07-27>
-- Author:		SOFTECH SISTEMAS
-- Create date: 22/09/2009
-- Description:	Obtiene la tasa de la moneda adicional
-- =============================================
CREATE PROCEDURE [pObtenerTasaAdicional]
    (
      @sCodEmpresa CHAR(20) ,
      @deTasa DECIMAL(21, 8) OUT ,
      @iRslt INT = 0 OUT
		
    )
AS 
    BEGIN
        SET NOCOUNT ON ;

        DECLARE @sCodMonedaAdicional CHAR(6) ;
        SET @sCodMonedaAdicional = ( SELECT
                                        RTRIM(i_moneda_articulo)
                                     FROM
                                        par_emp
                                     WHERE
                                        cod_emp = @sCodEmpresa
                                   ) ;
	
        IF RTRIM(@sCodMonedaAdicional) <> '' 
            BEGIN
                SET @deTasa = ( SELECT TOP 1
                                    tasa_v
                                FROM
                                    saTasa
                                WHERE
                                    co_mone = @sCodMonedaAdicional
                                ORDER BY
                                    fecha DESC
                              ) ;
                IF @deTasa IS NULL 
                    BEGIN
                        SET @deTasa = 1 ;
                        SET @iRslt = 1 ; --Valor de tasa no encontrado;
                    END
                ELSE 
                    SET @iRslt = 0 ;	
            END
	
        IF @sCodMonedaAdicional IS NULL 
            SET @iRslt = 2 ; --Valor de moneda adicional nulo
		
        IF @sCodMonedaAdicional = '' 
            SET @iRslt = 3 ; --Valor de moneda adicional no especificado
		
        SET NOCOUNT OFF ;
    END
```
