# SP: pObtenerConfiguracionNCFFactVen
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`saConfigFacturaVenta`](../tables/saConfigFacturaVenta.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <27/05/2019>
-- Description:	Obtener la configuración de un proceso que maneje NCF (Dominicana)
-- =============================================
--EXEC pObtenerConfiguracionNCFFactVen 'NCF14', 'PROFIT', '300'

CREATE PROCEDURE [dbo].[pObtenerConfiguracionNCFFactVen]
    (
      @sTipo VARCHAR(max),
	  @cUsuario CHAR(6),
	  @cMapa CHAR(6)
    )
AS 
    BEGIN
	
		DECLARE @Resultados TABLE(habilitado Varchar(5), serie Varchar(20));
		DECLARE @Expresion VARCHAR(max)
	
		SET NOCOUNT ON;	
		SET @sTipo = RTRIM(@sTipo)
		SET @cUsuario = RTRIM(@cUsuario)
		SET @cMapa = RTRIM(@cMapa)
		
		SET @Expresion = 'SELECT contr.C.value(''@Habilitado'', ''Varchar(5)'') AS habilitado, ' + 
			'contr.C.value(''@Valor_Defecto'', ''Varchar(20)'') AS serie FROM ' + 
			'saConfigFacturaVenta CROSS APPLY xml_reglas.nodes(''/Reglas/Adicional/IfCombo/' + @sTipo + ''') contr ( c ) '
		
        INSERT INTO @Resultados (habilitado, serie) EXEC(@Expresion + 'WHERE co_usuario = ''' + @cUsuario + '''')
		
		IF ( NOT EXISTS (SELECT 1 FROM @Resultados) ) 
            BEGIN
                INSERT INTO @Resultados EXEC(@Expresion + 'WHERE co_mapa = ''' + @cMapa + '''')
            END
			
		SELECT * FROM @Resultados

    END
```
