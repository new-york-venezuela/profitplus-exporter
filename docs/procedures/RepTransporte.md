# SP: RepTransporte
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`saAdiCampo`](../tables/saAdiCampo.md)
- [`saTransporte`](../tables/saTransporte.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-03-10>
-- Description:	<Reporte de transportes>
-- =============================================
CREATE PROCEDURE [dbo].[RepTransporte]
    @sCo_Trans_d CHAR(6) = NULL,
    @sCo_Trans_h CHAR(6) = NULL,
    @sCo_Sucursal CHAR(6) = NULL,
    @sCampOrderBy VARCHAR(16) = NULL,
    @sDir VARCHAR(6) = 'ASC', 
    @bHeaderRep BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @sOrdenDireccion VARCHAR(4)

    IF UPPER(@sDir) IN ('DESC', 'DES', 'DESCENDENTE')
        SET @sOrdenDireccion = 'DESC'
    ELSE
        SET @sOrdenDireccion = 'ASC'

    IF @sCampOrderBy NOT IN ('co_tran', 'des_tran')
        SET @sCampOrderBy = 'co_tran'

    DECLARE @DirFis NVARCHAR(254)
    DECLARE @Telef NVARCHAR(254)

    SELECT @DirFis = val_str FROM saAdiCampo WHERE co_adicampo = 'dir_fis'
    SELECT @Telef = val_str FROM saAdiCampo WHERE co_adicampo = 'telef'

    DECLARE @SQL NVARCHAR(MAX)

    SET @SQL = '
    SELECT 
        T.co_tran,
        T.des_tran,
        T.co_sucu_in,
        CASE 
            WHEN T.clasificacion = ''C'' THEN ''Conductor''
            WHEN T.clasificacion = ''T'' THEN ''Transporte''
            ELSE ''Sin clasificar''
        END AS Clasificacion,
        ''' + @DirFis + ''' AS DirFis,
        ''' + @Telef + ''' AS Telef
    FROM saTransporte AS T
    WHERE 1=1'

    IF @sCo_Trans_d IS NOT NULL
        SET @SQL += ' AND T.co_tran >= ''' + @sCo_Trans_d + ''''

    IF @sCo_Trans_h IS NOT NULL
        SET @SQL += ' AND T.co_tran <= ''' + @sCo_Trans_h + ''''

    IF @sCo_Sucursal IS NOT NULL
        SET @SQL += ' AND T.co_sucu_in = ''' + @sCo_Sucursal + ''''

    SET @SQL += ' ORDER BY ' + @sCampOrderBy + ' ' + @sOrdenDireccion

    EXEC sp_executesql @SQL
END
```
