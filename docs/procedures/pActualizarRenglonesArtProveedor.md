# SP: pActualizarRenglonesArtProveedor
**Tipo**: Actualizar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saArtProveedorReng`](../tables/saArtProveedorReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pActualizarRenglonesArtProveedor]
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarRenglonesArtProveedor]
    (
      @sCo_Art CHAR(30) ,
      @sCo_ArtOri CHAR(30) ,
      @sCo_Prov CHAR(16) ,
      @sCo_ProvOri CHAR(16) ,
      @iReng_Num INT ,
      @iReng_NumOri INT ,
      @sProv_Des NVARCHAR(100) = NULL ,
      @dFecha DATETIME = NULL ,
      @sObservacion NVARCHAR(MAX) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
	
    )
AS 
    BEGIN  

        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
		
        UPDATE
            saArtProveedorReng
        SET co_art = @sCo_Art, co_prov = @sCo_Prov, reng_num = @iReng_Num, fecha = @dFecha, observacion = @sObservacion,
            co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(), trasnfe = @sTrasnfe,
            revisado = @sRevisado
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_art = @sCo_ArtOri
            AND co_prov = @sCo_ProvOri
            AND reng_num = @iReng_NumOri
    
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
	
        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
	
        IF @dtFe_In IS NOT NULL 
            BEGIN
		-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saArtProveedorReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                    @sCampos = @sCampos
            END
	
        SELECT
            *
        FROM
            @TableTimestamp
	
    END
```
