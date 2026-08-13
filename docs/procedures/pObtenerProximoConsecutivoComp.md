# SP: pObtenerProximoConsecutivoComp
**Tipo**: Obtener
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pObtenerProximoConsecutivoComp
DESCRIPCION: Devuelve el proximo numero consecutivo del Comprobante Diario
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerProximoConsecutivoComp]
    (
      @sTabla VARCHAR(50) ,
      @iMes INT ,
      @iAnho INT
	
    )
AS 
    BEGIN
        DECLARE @sStringCommand VARCHAR(8000)

        SET @sStringCommand = 'DECLARE @iProximo_Numero Int
	SET @iProximo_Numero = (SELECT ISNULL(Max(comp_num),0)+1 as Proximo_Numero FROM ' + @sTabla + ' WHERE Mes = '
            + CAST(@iMes AS VARCHAR(2)) + ' and Anho = ' + CAST(@iAnho AS VARCHAR(4)) + ') 
	SELECT @iProximo_Numero As Proximo_Numero'

        EXEC(@sStringCommand)
    END
```
