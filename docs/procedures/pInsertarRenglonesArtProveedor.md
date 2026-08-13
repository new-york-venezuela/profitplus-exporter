# SP: pInsertarRenglonesArtProveedor
**Tipo**: Insertar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saArtProveedorReng`](../tables/saArtProveedorReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pInsertarRenglonesArtProveedor
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pInsertarRenglonesArtProveedor]
    (
      @sCo_Art CHAR(30) ,
      @sCo_Prov CHAR(16) ,
      @iReng_Num INT ,
      @sProv_Des NVARCHAR(100) = NULL ,
      @dFecha DATETIME = NULL ,
      @sObservacion NVARCHAR(MAX) ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @sMaquina VARCHAR(60) = NULL
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
	
        INSERT  INTO saArtProveedorReng
                ( co_art, co_prov, reng_num, fecha, observacion, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo,
                  fe_us_mo, trasnfe, revisado )
        OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Art, @sCo_Prov, @iReng_Num, @dFecha, @sObservacion, @sCo_Us_In, @sCo_Sucu_In, GETDATE(),
                  @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sTrasnfe, @sRevisado )	

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saArtProveedorReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCo_Art
	
        SELECT
            *
        FROM
            @TableTimestamp

    END
```
